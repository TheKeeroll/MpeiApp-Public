import {BARSMarks, Mark, MarkDiff} from "../DataTypes";

const CheckExamOrResult = (disciplineName: string, a: Mark[], b: Mark[], isExam: boolean) => {
    const result: MarkDiff[] = []

    // if len in different -> first item in a is a new mark
    if(a.length > b.length){
        console.log(isExam ? 'Exams' : 'Result' + 'havent same len difference:', {
            discipline: disciplineName,
            kmName: isExam ? 'Экзамен' : 'Итог',
            mark: a[0].mark
        });

        result.push({
            discipline: disciplineName,
            kmName: isExam ? 'Экзамен' : 'Итог',
            mark: a[0].mark
        })
    } else {
        //else iterate over every mark
        for(let i = 0; i < a.length; i++){
            if(JSON.stringify(a[i]) != JSON.stringify(b[i])){
                result.push({
                    discipline: disciplineName,
                    kmName: isExam ? 'Экзамен' : 'Итог',
                    mark: a[i].mark
                })
            }
        }
    }

    return result
}

const MarkCompare = (a: Mark, b: Mark) => {
    return a.mark != b.mark
}

export default function GetMarksDifference(a: BARSMarks, b: BARSMarks){
    let result: MarkDiff[] = [] // Array for storing difference

    if(a.semesterID != b.semesterID) return []; //if sems are different -> nothing changed

    //iterate over every discipline (assume that discipline length is same)
    for(let i = 0; i < a.disciplines.length; i++){
        /*
         1. Check result marks
         2. Check exam marks
         3. Check kms
        */

        result = result.concat(CheckExamOrResult(a.disciplines[i].name, a.disciplines[i].examMarks, b.disciplines[i].examMarks, true))
        result = result.concat(CheckExamOrResult(a.disciplines[i].name, a.disciplines[i].resultMarks, b.disciplines[i].resultMarks, false))

        //kms check. iterate over every km
        for(let k = 0; k < a.disciplines[i].kms.length; k++){
            /*
             1. Compare marks length -> push into result else compare each mark as string
            */
            if(a.disciplines[i].kms[k].marks.length > a.disciplines[i].kms[k].marks.length){
                result.push({
                    discipline: a.disciplines[i].name,
                    kmName: a.disciplines[i].kms[k].name,
                    mark: a.disciplines[i].kms[k].marks[0].mark
                })
            } else {
                for(let j = 0; j < a.disciplines[i].kms[k].marks.length; j++){
                    if(MarkCompare(a.disciplines[i].kms[k].marks[j], b.disciplines[i].kms[k].marks[j])){
                        result.push({
                            discipline: a.disciplines[i].name,
                            kmName: a.disciplines[i].kms[k].name,
                            mark: a.disciplines[i].kms[k].marks[j].mark
                        })
                    }
                }
            }
        }
    }
    return result;
}




