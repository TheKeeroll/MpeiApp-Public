import { BARSData } from "./DataTypes";

export const TEST_DATA: BARSData = {
    marks:    require('../../assets/testData/marks.json'),
    student:  require("../../assets/testData/student.json"),
    reports:  require("../../assets/testData/reports.json"),
    //@ts-ignore
    records: [],
    schedule:  require("../../assets/testData/schedule.json"),
    availableSemesters: [],
    skippedClasses:[]
}
