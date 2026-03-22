import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Alert, Image, Linking, StyleSheet, View,} from "react-native";
import {useTheme} from "react-native-paper";
import {
  Camera,
  CameraDevice,
  CameraDeviceFormat,
  getCameraDevice,
  useCameraDevices,
  useCodeScanner
} from "react-native-vision-camera";
// import { useFrameProcessor } from "react-native-vision-camera";
import {useFocusEffect} from "@react-navigation/native";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import {QR_PRESENCE_HEADER, URLS} from "../../Common/Constants";
import BARSAPI from "../../Common/Globals";
// @ts-expect-error
import {ImageSource} from "react-native-vector-icons/Icon";
import {parse} from "node-html-parser";
import { scheduleOnRN } from "react-native-worklets";

function getBrightestFormat(device: CameraDevice | undefined): CameraDeviceFormat | undefined {
  if (!device?.formats?.length) return undefined;
  return device.formats
      .filter((f) => f.photoHeight && f.videoHeight && f.minISO != null && f.maxISO != null)
      .sort((a, b) => {
        // Чем длиннее выдержка (minShutter), тем светлее
        const isoScore = (a.minISO || 0) - (b.minISO || 0); // ниже ISO — лучше
        const resolutionScore = (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight);

        return (
           resolutionScore * 0.0001 + isoScore * 0.5
        );
      })[0];
}

const QRCodeScanner: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const [isHandlingBARS_QR, setHandlingBARS_QR] = useState(false);
  const { colors } = useTheme();
  const devices = useCameraDevices();
  const device = getCameraDevice(devices, 'back', {
    physicalDevices: [
      'ultra-wide-angle-camera',
      'wide-angle-camera',
      'telephoto-camera'
    ]})
  const format = useMemo(() => getBrightestFormat(device), [device]);
  /*const minFps = Math.max(format?.minFps || 30, 30)
  const maxFps = Math.min(format?.maxFps || 30, 240)*/

  let handling_barcode = '';
  let isAlert = false;

  const GetSelectedQRFrame: ImageSource = () => {
    const FRAMES = {
      "qr-frame": require("../../../assets/images/QRScan/qr-frame.webp"),
      "empty": require("../../../assets/images/QRScan/empty.webp"),
      "qr-frame-black": require("../../../assets/images/QRScan/qr-frame-black.webp"),
      "qr-frame-green": require("../../../assets/images/QRScan/qr-frame-green.webp"),
      "qr-frame-red": require("../../../assets/images/QRScan/qr-frame-red.webp"),
    };
    return (FRAMES as any)[BARSAPI.QRFrame];
  };

  const HandlePresenceQRResponse = (response_text: string) => {
    const $ = parse(response_text)
    const main_info = $.querySelector('body > div.row.mt-2 > div:nth-child(1) > span > span.fw-bold')?.text.trim()
    const status = $.querySelector('body > div.row.mt-2 > div:nth-child(2) > span')?.text.trim()
    console.log('main_info: ' + main_info + ' status: ' + status);
    let headline = 'Успешная регистрация!'
    let mes = 'QR ID - ' + (main_info || '') + '\n' + (status || '')
    if (status?.includes('не действительна')) {
      headline = 'Не удалось зарегистрироваться'
      mes = status
    } else if (typeof main_info == 'undefined') {
      headline = 'Не удалось зарегистрироваться'
      mes = 'Попробуйте ещё раз. Если проблема сохраняется, пожалуйста, сообщите разработчику!'
    }
    Alert.alert(headline, mes, [{
      text: 'ОК',
      onPress: () => {
        console.log('QR BARSPresence - alert closed')
        setHandlingBARS_QR(false);
        isAlert = false
      }
    }])
  };

  const HandleBARSPresenceQR = async (qr_link: string) => {
    console.log('BARS presence confirm QR detected - handling...')
    const qrID = qr_link.split('=')[1].split('&')[0]
    const s = qr_link.split('=')[2]
    console.log('QR ID: ' + qrID + ' s: ' + s);
    // let user_creds = BARSAPI.GetCreds()
    const qr_combined_url = URLS.BARS_QR_PRESENCE + qrID + '%26s%3D' + s
    console.log('qr_combined_url = ' + qr_combined_url);
    const response = await fetch(qr_link, {
      method: 'GET',
      headers: QR_PRESENCE_HEADER(qr_combined_url),
      credentials: 'include'
    }).then(async (res) => {
      const res_text = await res.text();
      HandlePresenceQRResponse(res_text);
    })
  };

  const handleBarcode = useCallback((data: string) => {
    console.log("Barcode data: ", data);
    if (
        data.includes("bars_web/QR/Presence") &&
        data !== handling_barcode && !isHandlingBARS_QR &&
        !isAlert
    ) {
      handling_barcode = data;
      setHandlingBARS_QR(true);
      HandleBARSPresenceQR(data);
    } else if (
        (data.toLowerCase().includes("http") ||
            data.toLowerCase().includes("www")) &&
        data !== handling_barcode && !isHandlingBARS_QR &&
        !isAlert
    ) {
      handling_barcode = data;
      isAlert = true;
      Alert.alert("Результат сканирования", data, [
        {
          text: "Закрыть",
          onPress: () => {
            isAlert = false;
          },
        },
        {
          text: "Перейти по ссылке",
          onPress: () => {
            Linking.openURL(data).finally(() => (isAlert = false));
          },
        },
      ]);
    } else if (!isAlert && data !== handling_barcode && !isHandlingBARS_QR) {
      handling_barcode = data;
      isAlert = true;
      Alert.alert("Результат сканирования", data, [
        {
          text: "ОК",
          onPress: () => {
            isAlert = false;
          },
        },
      ]);
    }
  }, [handling_barcode, isHandlingBARS_QR, isAlert]);

  /*const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    const barcodes = scanBarcodes(frame, [BarcodeFormat.QR_CODE]);
    if (barcodes.length > 0) {
      const raw = barcodes[0]?.rawValue ?? "";
      runOnJS(handleBarcode)(raw);
    }
  }, [handleBarcode]);*/
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (codes.length > 0) {
        const raw = codes[0]?.value ?? "";
        scheduleOnRN(handleBarcode, raw);
      }
    }
  })

  useEffect(() => {
    (async () => {
      const permission = await Camera.requestCameraPermission();
      const granted = permission === "granted";
      setHasPermission(granted);
      setIsLoading(!granted);
    })();
  }, []);

  useFocusEffect(
      useCallback(() => {
        setCameraKey((prevKey) => prevKey + 1);
        return () => {
          setIsLoading(true);
        };
      }, [])
  );

  if (!device || !hasPermission) {
    return <LoadingScreen />;
  }

  return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Camera
            key={cameraKey}
            style={styles.preview}
            device={device}
            isActive={true}
            // frameProcessor={frameProcessor}
            codeScanner={codeScanner}
            format={format}
            // fps={[minFps, maxFps]}
            enableZoomGesture={true}
            lowLightBoost={device.supportsLowLightBoost}
            onInitialized={() => {
              setIsLoading(false);
            }}
        />
        {isLoading ? (
            <LoadingScreen />
        ) : (
            <View style={styles.overlayContainer}>
              <Image source={GetSelectedQRFrame()} style={styles.scanOverlay} />
            </View>
        )}
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scanOverlay: {
    width: 300,
    height: 300,
    resizeMode: "contain",
  },
});

export default QRCodeScanner;
