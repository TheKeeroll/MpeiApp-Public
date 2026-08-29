package com.mpeiapp;

import android.content.Context;

import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.facebook.react.views.view.WindowUtilKt;
import com.facebook.soloader.SoLoader;

import java.io.IOException;

/**
 * Initializes React Native with the stable defaults plus the Android Fabric
 * mount-order safeguard. This mirrors the generated application entry point,
 * but supplies the feature-flag provider before the React runtime is created.
 */
final class ReactNativeInitializer {
    private ReactNativeInitializer() {
    }

    static void load(Context context) {
        try {
            SoLoader.init(context, OpenSourceMergedSoMapping.INSTANCE);
        } catch (IOException error) {
            throw new RuntimeException(error);
        }

        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            DefaultNewArchitectureEntryPoint.loadWithFeatureFlags$ReactAndroid(
                new ReactNativeNewArchitectureFeatureFlagsDefaults() {
                    @Override
                    public boolean disableMountItemReorderingAndroid() {
                        return true;
                    }
                }
            );
        }

        if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
            WindowUtilKt.setEdgeToEdgeFeatureFlagOn();
        }
    }
}
