package com.mpeiapp;

import android.os.Build;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

public class DeviceArchitectureModule extends ReactContextBaseJavaModule {
    public DeviceArchitectureModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "DeviceArchitecture";
    }

    @ReactMethod
    public void getSupportedAbis(Promise promise) {
        WritableArray abis = Arguments.createArray();
        for (String abi : Build.SUPPORTED_ABIS) {
            abis.pushString(abi);
        }
        promise.resolve(abis);
    }
}
