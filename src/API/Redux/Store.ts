import {configureStore} from "@reduxjs/toolkit";
import BARSReducers from "./Slices";

export const Store = configureStore({
    reducer: BARSReducers
})

export type RootState = ReturnType<typeof Store.getState>
export type AppDispatch = typeof Store.dispatch
