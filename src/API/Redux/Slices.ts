import {combineReducers, createSlice, PayloadAction} from "@reduxjs/toolkit";
import {
    BARSMarks,
    BARSTask,
    BARSQuestionnaire,
    BARSRecordBookSemester,
    BARSReport,
    BARSSchedule,
    SkippedClass, BARSStipend, BARSOrder,
} from "../DataTypes";

interface ReduxStatePlaceHolder<T>{
    status: "LOADING" | "LOADED" | "OFFLINE" | "FAILED",
    data: T | null
}

const initialState = <T>(): ReduxStatePlaceHolder<T> => ({status: "LOADING", data: null})

export const MarkTableSlice = createSlice({
    name: 'MarkTable',
    initialState: initialState<BARSMarks>(),
    reducers:{
        updateMarkTable: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSMarks>>)=> {
            return action.payload
        }
    }
})

export const SkippedClassesSlice = createSlice({
    name: 'skippedClasses',
    initialState: initialState<SkippedClass[]>(),
    reducers:{
        updateSkippedClasses:(state, action: PayloadAction<ReduxStatePlaceHolder<SkippedClass[]>>)=>{
            return action.payload
        }
    }
})

export const RecordBookSlice = createSlice({
    name: 'RecordBook',
    initialState: initialState<BARSRecordBookSemester[]>(),
    reducers:{
        updateRecordBook:(state, action: PayloadAction<ReduxStatePlaceHolder<BARSRecordBookSemester[]>>)=>{
            return action.payload
        }
    }
})

export let ScheduleSlice = createSlice({
    name: 'Schedule',
    initialState:initialState<BARSSchedule>(),
    reducers:{
        updateSchedule: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSSchedule>>)=> {
            return action.payload
        }
    }
})

export const TasksSlice = createSlice({
    name: 'tasks',
    initialState:initialState<BARSTask[]>(),
    reducers:{
        updateTasks: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSTask[]>>) => {
            return action.payload
        }
    }
})

export const ReportsSlice = createSlice({
    name: 'reports',
    initialState:initialState<BARSReport[]>(),
    reducers:{
        updateReports: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSReport[]>>) => {
            return action.payload
        }
    }
})

export const StipendsSlice = createSlice({
    name: 'stipends',
    initialState:initialState<BARSStipend[]>(),
    reducers:{
        updateStipends: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSStipend[]>>) => {
            return action.payload
        }
    }
})

export const OrdersSlice = createSlice({
    name: 'orders',
    initialState:initialState<BARSOrder[]>(),
    reducers:{
        updateOrders: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSOrder[]>>) => {
            return action.payload
        }
    }
})

export const QuestionnairesSlice = createSlice({
    name: 'questionnaires',
    initialState:initialState<BARSQuestionnaire[]>(),
    reducers:{
        updateQuestionnaires: (state, action: PayloadAction<ReduxStatePlaceHolder<BARSQuestionnaire[]>>) => {
            return action.payload
        }
    }
})

export const {updateSkippedClasses} = SkippedClassesSlice.actions
export const {updateSchedule} = ScheduleSlice.actions
export const {updateMarkTable} = MarkTableSlice.actions
export const {updateTasks} = TasksSlice.actions
export const {updateReports} = ReportsSlice.actions
export const {updateQuestionnaires} = QuestionnairesSlice.actions

export const {updateStipends} = StipendsSlice.actions

export const {updateOrders} = OrdersSlice.actions
export const {updateRecordBook} = RecordBookSlice.actions
let BARSReducers = combineReducers({
    MarkTable: MarkTableSlice.reducer,
    Schedule: ScheduleSlice.reducer,
    Tasks: TasksSlice.reducer,
    Reports: ReportsSlice.reducer,
    Questionnaires: QuestionnairesSlice.reducer,
    Stipends: StipendsSlice.reducer,
    Orders: OrdersSlice.reducer,
    SkippedClasses: SkippedClassesSlice.reducer,
    RecordBook: RecordBookSlice.reducer
})
export default BARSReducers

