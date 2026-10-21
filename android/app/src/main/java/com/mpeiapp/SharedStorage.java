package com.mpeiapp;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SharedStorage extends ReactContextBaseJavaModule {
    private final ReactApplicationContext context;

    public SharedStorage(ReactApplicationContext reactContext) {
        super(reactContext);
        context = reactContext;
    }

    @NonNull @Override public String getName() { return "SharedStorage"; }

    private void writeSchedule(String json) throws Exception {
        JsonParser.parseJson(json);
        if (!context.getSharedPreferences("DATA", Context.MODE_PRIVATE).edit().putString("appData", json).commit()) {
            throw new java.io.IOException("Widget storage write failed");
        }
        // Application context also works during background updates; no Activity required.
        ScheduleWidget.updateAll(context);
    }

    @ReactMethod public void setSchedule(String json, Promise promise) {
        try { writeSchedule(json); promise.resolve(null); }
        catch (Exception error) { promise.reject("E_WIDGET_DATA", "Could not save the widget schedule"); }
    }

    @ReactMethod public void clearSchedule(Promise promise) {
        try {
            if (!context.getSharedPreferences("DATA", Context.MODE_PRIVATE).edit().remove("appData").commit()) {
                throw new java.io.IOException("Widget storage clear failed");
            }
            ScheduleWidget.clearState(context);
            ScheduleWidget.updateAll(context);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("E_WIDGET_STORAGE", "Could not clear the widget schedule");
        }
    }

    // Retain the original bridge entry point for an already running old JS bundle.
    @ReactMethod public void set(String json) {
        try { writeSchedule(json); }
        catch (Exception error) { Log.w("ScheduleWidget", "Could not save legacy schedule"); }
    }
}
