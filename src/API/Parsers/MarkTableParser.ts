import {BARSError, CreateBARSError, isBARSError} from "../Error/Error";
import { BARSDiscipline, BARSMarks, KM, Mark, Teacher } from "../DataTypes";
import {parse, HTMLElement} from 'node-html-parser'

const DisciplineFromHeader = (header: string) => {
  let f: any[]
  if (header.includes("руководитель")){
    f = header.split(/[0-9]([А-Я]){2}/u)[0].split('),')[0].includes(',') ? header.split(/[0-9]([А-Я]){2}/u)[0].split('),')[0].split(',') : header.split(/[0-9]([А-Я]){2}/u)[0].split('),')[0].split('(')
    for (let j=0;  j <= f.length; j++){
      try {
        if(f[j].includes("руководитель")){
          f[j].replace("руководитель", "рук.")
        }
      } catch (e:any){
      }
    }
  } else {
    f = header.split(/[0-9]([А-Я]){2}/u)[0].split('.,')[0].split(',')
  }
    f.pop()
    //Clipboard.setString(header)
    //console.log('sp',f.join(','))
    return f.join(',')//header.split('\n')[0];

}
const ShouldSkipKm = (name: string) => {
  for(let i of ['Текущий контроль:', 'Контрольная неделя №1', 'Контрольная неделя №2', 'Контрольная неделя №3', 'Название контрольного мероприятия', 'Семестровая составляющая:', '5:']){
    if(name.includes(i)) return true
  }
  return false
}

const ExamTypeFromHeader = (header: string)=>{
  for(let i of ['экзамен', 'зачёт с оценкой', 'зачёт (без оценки)', 'защита КП/КР']){
    if(header.includes(i)) return i
  }
  return 'NaN'
}

export default function ParsMarkTable(raw: string): BARSMarks | BARSError{
  console.time('ParsMarkTable')

  const IsExamOrResult = (name: string)=>{
    for(let i of ['Промежуточная аттестация', 'Итоговая оценка:']){
      if(name.includes(i)) return true
    } return false
  }

  const disciplines: BARSDiscipline[] = []
  let semId = ''

  try{
    const $ = parse(raw)
    $.querySelector('.ddl_StudyFilterSemester')!.querySelectorAll('option').forEach((v)=>{
      if (v.attrs['selected'] == 'selected'){
        semId = v.attrs['value']
      }
    })
    const $h = $.querySelectorAll('.my-2')
    const $br = $.querySelectorAll('.collapse')
    const $b: HTMLElement[] = []
    $br!.forEach((v)=>{
      if(v.id.includes('s_ss'))
        $b.push(v)
    })

    for(let i = 0; i < $h.length; i++){
      const headerRaw = $h[i].text.trim()
      const name = DisciplineFromHeader(headerRaw)
      if(name == 'NaN'){
        console.warn('No discipline found in: ' + headerRaw);
        return CreateBARSError('MARK_TABLE_PARSER_FAIL', 'No discipline found in ' + headerRaw)
      }
      let examType = ExamTypeFromHeader(headerRaw)
      if(examType == 'NaN') examType = '-'
      const puuSplit = headerRaw.split('сдать до')
      const passUpUntil = puuSplit.length > 1 ? puuSplit[1].trim() : '-'
      let teacher: Teacher
      try {
        teacher = {
          name: headerRaw.split(',')[name.split(',').length].trim(), lec_oid: ''}
      }
      catch (e:any){
        console.warn("BARS marks screen: teachers' names parser failed!")
        teacher = {
          name: '-', lec_oid: ''}
      }

      const kms: KM[] = []
      const examMarks: Mark[] = []
      const resultMarks: Mark[] = []
      const $trs = $b[i].querySelectorAll('tr')
      let sredBall = ''
      $trs.shift()
      $trs.shift()
      for(let k of $trs){
        if(ShouldSkipKm(k.text)) {
          continue
        }
        if(k.text.includes('Балл текущего контроля:')){
          sredBall = k.text.replace('Балл текущего контроля:', '').trim()
        } else if(IsExamOrResult(k.text)){
          const promOrResult = k.text.includes('Промежуточная аттестация') //true - prom
          const rawMark = k.childNodes[3].text.trim()
          const retake1 = rawMark.includes('ППА1 - ') ? rawMark.split('ППА1 - ')[1] : '' //ППА2 - -
          const retake2 = retake1 != '' && retake1.includes('ППА2 - ') ? retake1.split('ППА2 - ')[1] :  ''
          const redSession = retake2 != '' && retake2.includes('КС - ') ? retake2.split('КС - ')[1] : ''

          const currentMark: Mark = {
            mark: rawMark.charAt(0) == '' ? '-' : rawMark.charAt(0),
            date: promOrResult ? rawMark.split(')')[0].split('(')[1] : '',
            type: 'CURRENT'
          }
          if(promOrResult)
            examMarks.push(currentMark)
          else
            resultMarks.push(currentMark)

          if(retake1 != ''){
            const retake1Mark: Mark = {
              mark: retake1.charAt(0),
              date: promOrResult ? retake1.split(')')[0].split('(')[1] : '-',
              type: 'RETAKE_EXAM_1'
            }

            if(promOrResult)
              examMarks.push(retake1Mark)
            else
              resultMarks.push(retake1Mark)

            if(retake2 != ''){
              const retake2Mark: Mark = {
                mark: retake2.includes('- ') ? retake2.charAt(2) : retake2.charAt(0),
                date: promOrResult ? retake2.split(')')[0].split('(')[1] : '-',
                type: 'RETAKE_EXAM_2'
              }

              if(promOrResult)
                examMarks.push(retake2Mark)
              else
                resultMarks.push(retake2Mark)

            }
            if(redSession != ''){
              const redSessionMark: Mark = {
                mark: redSession.charAt(0),
                date: promOrResult ? redSession.split(')')[0].split('(')[1] : '-',
                type: 'RED_SESSION'
              }

              if(promOrResult)
                examMarks.push(redSessionMark)
              else
                resultMarks.push(redSessionMark)

            }
          }
        } else {
          let kmWeek = "-"
          try {
            kmWeek = k.childNodes[5].text
          } catch (e:any){
            console.warn('kmWeek trouble! ' + e.toString())
          }
          let kmName = " "
          try {
            kmName = k.childNodes[1].text
          } catch (e:any){
            console.warn('kmName trouble! ' + e.toString())
          }
          if (kmName.includes("(критерии)")){
            kmName = kmName.replace("   (критерии)", "")
          }
          const km: KM = {
            marks:[],
            week: kmWeek,
            name: kmName
          }
          let rawKmMark = ' '
          try {
             rawKmMark = k.childNodes[7].text.trim()
          } catch (e:any){
            console.warn('rawKmMark trouble! ' + e.toString())
          }

          const retake = rawKmMark.includes('Пересдана:') ? rawKmMark.split('Пересдана:')[1] : ''
          const notCounted = rawKmMark.includes('Не учитывается:') ? rawKmMark.split('Не учитывается:')[1] : ''
          const currentMark: Mark = {
            mark: rawKmMark.charAt(0) == '' ? '-' : rawKmMark.charAt(0),
            date:rawKmMark.split(')')[0].split(' (')[1],
            type: 'CURRENT'
          }

          km.marks.push(currentMark)
          if(retake != ''){
            const retakeMark: Mark = {
              mark: retake.charAt(1),
              date: retake.split(' (')[1].replace(')', ''),
              type: 'RETAKE'
            }
            km.marks.push(retakeMark)
          }
          if(notCounted != ''){
            const notCountedMark: Mark = {
              mark: notCounted.charAt(1),
              date: notCounted.split(' (')[1].replace(')', ''),
              type: 'NOT_TAKEN_INTO_ACCOUNT'
            }
            km.marks.push(notCountedMark)
          }
          kms.push(km)
        }
      }
      console.log('Discipline parsed: ' + name + ', ' + teacher.name)
      disciplines.push({
        name,
        examType,
        passUpUntil,
        teacher,
        kms,
        examMarks,
        resultMarks,
        sredBall
      })
    }
    console.timeEnd('ParsMarkTable')
    return {
        disciplines,
        semesterName: $.querySelector('#div-Student_SemesterSheet__Mark')!.querySelector('span')!.text.trim(),
        semesterID: semId
      } as BARSMarks
    } catch (e: any){
      try {
        return {
          disciplines,
          semesterName: " ",
          semesterID: semId
        } as BARSMarks
      }catch (e) {
        if(isBARSError(e)) return e
        return CreateBARSError('MARK_TABLE_PARSER_FAIL')
      }
  }
}
