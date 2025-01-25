import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RNCamera } from 'react-native-camera';
import {useTheme} from "react-native-paper";

const QRCodeScanner: React.FC = () => {
  const {colors} = useTheme()
  const [qrCode, setQrCode] = useState<string | null>(null);

  const PendingView = () => (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Waiting...</Text>
    </View>
  );

  const handleBarCodeRead = (e: { data: string }) => {
    // setQrCode(e.data);
    console.log('handleBarCodeRead: ' + e.data);
  };
  console.log('QRCodeScanner opened');
  return (
    <View style={[Styles.container, {backgroundColor: colors.surface}]}>
      <RNCamera
        style={Styles.preview}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.on}
        onGoogleVisionBarcodesDetected={({ barcodes }) => {
          console.log('BarcodesDetected: ' + barcodes.toString());
        }}
      >
        {({ camera, status, recordAudioPermissionStatus }) => {
          if (status !== 'READY') return <PendingView />;
          return (
            <View style={{ flex: 0, flexDirection: 'row', justifyContent: 'center' }}>
              <TouchableOpacity onPress={   // @ts-ignore
                () => this.takePicture(camera)} style={Styles.capture}>
                <Text style={{ fontSize: 14 }}> SNAP </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      </RNCamera>
    </View>
  );
}

const Styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  capture: {
    flex: 0,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 15,
    paddingHorizontal: 20,
    alignSelf: 'center',
    margin: 20,
  },
  qrText: {
    backgroundColor: '#00FF00',
    padding: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: 20,
  },
});

export default QRCodeScanner;
