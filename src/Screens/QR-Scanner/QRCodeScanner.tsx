import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Image } from "react-native";
import { Barcode, RNCamera } from "react-native-camera";
import { useTheme } from "react-native-paper";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import { LOGIN_HEADER, URLS } from "../../Common/Constants";
import BARS from "../../API/BARS";
import BARSAPI from "../../Common/Globals";
import { parse } from "node-html-parser";



const QRCodeScanner: React.FC = () => {

  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();

  const takePicture = async (camera: RNCamera) => {
    if (!camera) return;
    try {
      const options = { quality: 0.5, base64: true };
      const data = await camera.takePictureAsync(options);
      console.log('Photo saved at: ', data.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };


  const HandleBARSPresenceQR = async (qr_link: string)  => {
    console.log('BARS presence confirm QR detected - handling...')
    const qrID = qr_link.split('=')[1].split('&')[0]
    const s = qr_link.split('=')[2]
    console.log('QR ID: ' + qrID + ' s: ' + s);
    let user_creds = BARSAPI.GetCreds()
    console.log( 'Account: ' + user_creds.login + ' Password: ' + user_creds.password);
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
  let handling_barcode = '';
  let isAlert = false;
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <RNCamera
        style={styles.preview}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        onCameraReady={() => setIsLoading(false)}
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
          if (isLoading) {
            console.log('Camera isLoading: ', isLoading);
            return <LoadingScreen />;
          }
          return (
            <View style={styles.overlayContainer}>
              <Image source={require("../../../assets/images/QRScan/qr-frame.webp")} style={styles.scanOverlay} />
              <TouchableOpacity onPress={() => takePicture(camera)} style={styles.capture}>
                <Text style={{ fontSize: 14 }}>Фото</Text>
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
    backgroundColor: '#6600CC',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 20,
  },
});

export default QRCodeScanner;
