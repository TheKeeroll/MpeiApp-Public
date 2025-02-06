import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Image } from "react-native";
import { Barcode, RNCamera } from "react-native-camera";
import { useTheme } from "react-native-paper";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import { URLS } from "../../Common/Constants";
import BARSAPI from "../../Common/Globals";
import { parse } from "node-html-parser";
import { ImageSource } from "react-native-vector-icons/Icon";
import { useFocusEffect } from "@react-navigation/native";



const QRCodeScanner: React.FC = () => {

  const [isLoading, setIsLoading] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const { colors } = useTheme();

  const takePicture = async (camera: RNCamera) => {
    if (!camera) return;
    console.log('takePicture pressed');
  };

  const GetSelectedQRFrame: ImageSource = () => {
      const FRAMES = {
        "qr-frame": require('../../../assets/images/QRScan/qr-frame.webp'),
        "empty": require('../../../assets/images/QRScan/empty.webp'),
        "qr-frame-black": require('../../../assets/images/QRScan/qr-frame-black.webp'),
        "qr-frame-green": require('../../../assets/images/QRScan/qr-frame-green.webp'),
        "qr-frame-red": require('../../../assets/images/QRScan/qr-frame-red.webp'),
      }
    return (FRAMES as any)[BARSAPI.QRFrame]
  }

  const HandleBARSPresenceQR = async (qr_link: string)  => {
    console.log('BARS presence confirm QR detected - handling...')
    const qrID = qr_link.split('=')[1].split('&')[0]
    const s = qr_link.split('=')[2]
    console.log('QR ID: ' + qrID + ' s: ' + s);
    let user_creds = BARSAPI.GetCreds()
    const qr_combined_url = URLS.BARS_QR_PRESENCE + qrID + '%26s%3D' + s
    console.log('qr_combined_url = ' + qr_combined_url);
    const response = await fetch(qr_combined_url, {
      method: 'POST',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'ru,en;q=0.9',
        'content-type': 'application/json',
        'dnt': '1',
        'origin': 'https://bars.mpei.ru',
        'referer': qr_combined_url,
        'sec-ch-ua': `"Chromium";v="130", "YaBrowser";v="24.12", "Not(A:Brand";v="99", "Yowser";v="2.5"`,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': `"Windows"`,
        'sec-fetch-user': '?1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        Account: user_creds.login,
        Password: user_creds.password,
        RememberMe: false
      })
    }).then(async (response) => {
      const response_text = await response.text();
      const $ = parse(response_text)
      const main_info = $.querySelector('body > div.row.mt-2 > div:nth-child(1) > span > span.fw-bold')?.text.trim()
      const status = $.querySelector('body > div.row.mt-2 > div:nth-child(2) > span')?.text.trim()
      console.log('main_info: ' + main_info + ' status: ' + status);
      let headline = 'Успешная регистрация присутствия!'
      let mes = 'QR ID - ' + main_info + '\n' + status ?? ''
      if (status?.includes('не действительна')){
        headline = 'Не удалось зарегистрировать присутствие'
        mes = status
      }
      Alert.alert(headline, mes, [{
        text: 'ОК',
        onPress: () => {
          console.log('QR BARSPresence - alert closed')
          isAlert = false}}])
    })
  };
  useFocusEffect(
    useCallback(() => {
      console.log('QRCodeScanner is focused, resetting camera...');
      setCameraKey(prevKey => prevKey + 1); // Меняем ключ, чтобы камера пересоздалась
      return () => {
        console.log('QRCodeScanner is unfocused, cleaning up...');
        setIsLoading(true)
      };
    }, [])
  );
  let handling_barcode = '';
  let isAlert = false;
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <RNCamera
        key={cameraKey}  // Этот ключ заставляет пересоздать компонент камеры
        style={[styles.preview, { backgroundColor: colors.surface }]}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        onCameraReady={() => setIsLoading(false)}
        captureAudio={false}
        onStatusChange={() =>
        {console.log('status changed');
          setIsLoading(!isLoading)}}
        onGoogleVisionBarcodesDetected={({ barcodes }) => {
          barcodes.forEach(barcode => {
            console.log('Barcode data: ' + barcode.data);
            if (barcode.data.includes('bars_web/QR/Presence') && barcode.data != handling_barcode) {
              handling_barcode = barcode.data;
              HandleBARSPresenceQR(barcode.data);
            } else {
              if ((barcode.data.includes('http') || barcode.data.includes('www')) && barcode.data != handling_barcode && !isAlert) {
                isAlert = true;
                Alert.alert('Результат сканирования', barcode.data, [{
                  text: 'Закрыть',
                  onPress: () => {
                    console.log('QR with link - alert closed')
                    isAlert = false}
                }, { text: 'Перейти по ссылке', onPress: () => {Linking.openURL(barcode.data).then(r => isAlert = false)} }]);
              } else if (!isAlert && barcode.data != handling_barcode) {
                isAlert = true;
                Alert.alert('Результат сканирования', barcode.data, [{
                  text: 'ОК',
                  onPress: () => {
                    console.log('QR - alert closed')
                    isAlert = false}}])
              }
            }
          });
        }}
      >
        {({ camera, status }) => {
          if (camera) {
            camera.refreshAuthorizationStatus()
          }
          if (isLoading) {
            console.log('Camera isLoading: ' + isLoading + ' status: ' + status);
            if (status == 'READY') setIsLoading(false)
            return <LoadingScreen />;
          }
          return (
            <View style={styles.overlayContainer}>
              <Image source={GetSelectedQRFrame()} style={styles.scanOverlay} />
              <TouchableOpacity onPress={() => takePicture(camera)} style={styles.capture}>
                <Text style={{ fontSize: 14 }}> </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      </RNCamera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlayContainer: {
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanOverlay: {
    width: 250,
    height: 250,
    position: 'absolute',
    resizeMode: 'contain',
  },
  capture: {
    flex: 0,
    backgroundColor: 'transparent',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 20,
  },
});

export default QRCodeScanner;
