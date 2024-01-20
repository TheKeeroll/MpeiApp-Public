
declare global{
  interface Date{
    addDays(count: number): void
    substractDays(count: number): void
    dateFromBarsFormat(date: string): Date
    isBARSDate(date: string): boolean
    getDDMMYY(): string
    getDayName(full?: boolean): string
    getWeek(): number
    getMonthName(): string
    inRange(from: Date, to: Date): boolean
  }
}

Date.prototype.inRange = function(from: Date, to: Date): boolean {
  const fromNum = Date.parse(from.toDateString()) + from.getTime()
  const toNum = Date.parse(to.toDateString()) + to.getTime()
  const now = Date.parse(this.toDateString()) + this.getTime()
  //console.log(fromNum);
  //console.log(toNum);
  //console.log(now);
  //console.log(fromNum <= now, toNum >= now);
  return fromNum <= now && toNum >= now
}

Date.prototype.getMonthName = function(): string {
  const months: string[] =
      ['Янв','Фев','Мар','Апр','Мая','Июн','Июл','Авг','Сент','Окт','Нояб','Дек']
  return months[this.getMonth()]
}

Date.prototype.getWeek = function (): number {
  const dOffset = 1; // начало недели рус(1) пн англ(0) вс
  const year = new Date(this.getFullYear(), 0, 1)
  let day = year.getDay() - dOffset
  day = (day >= 0 ? day : day + 7)
  let dayNum = Math.floor(
      (this.getTime() - year.getTime() -
          (this.getTimezoneOffset() - year.getTimezoneOffset())*60000)
      /86400000) + 1
  let weekNum;
  if(day < 4)
  {
    weekNum = Math.floor((dayNum + day - 1) / 7) + 1
    if(weekNum > 52)
    {
      let nYear = new Date(this.getFullYear() + 1, 0, 1)
      let nDay = nYear.getDay() - dOffset
      nDay = (nDay >= 0 ? nDay : nDay + 7)
      weekNum = (nDay < 4 ? 1 : 53)
    }
  } else {
    weekNum = Math.floor((dayNum + day - 1) / 7)
  }
  return weekNum;
}

Date.prototype.getDayName = function (full?: boolean): string {
  let names: string[]
  // const names: string[] = full ? ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'] : ['Вс','Пн', 'Вт','Ср','Чт','Пт','Сб']
  let checkDate= new Date(this.getFullYear(), 0, 1)
  // console.log('checkDate = ' + checkDate.getDDMMYY())
  switch (checkDate.getDay()) {
    case 0:
      names = full ? ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'] : ['Вс','Пн', 'Вт','Ср','Чт','Пт','Сб']
      // console.log('The year starts from 0')
      break

    case 1:
      names = full ? ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'] : ['Пн', 'Вт','Ср','Чт','Пт','Сб','Вс']
      // console.log('The year starts from 1')
      break

    case 2:
      names = full ? ['Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье','Понедельник'] : ['Вт','Ср','Чт','Пт','Сб','Вс','Пн']
      // console.log('The year starts from 2')
      break

    case 3:
      names = full ? ['Среда','Четверг','Пятница','Суббота','Воскресенье','Понедельник','Вторник'] : ['Ср','Чт','Пт','Сб','Вс','Пн', 'Вт']
      // console.log('The year starts from 3')
      break

    case 4:
      names = full ? ['Четверг','Пятница','Суббота','Воскресенье','Понедельник','Вторник','Среда'] : ['Чт','Пт','Сб','Вс','Пн','Вт','Ср']
      // console.log('The year starts from 4')
      break

    case 5:
      names = full ? ['Пятница','Суббота','Воскресенье','Понедельник','Вторник','Среда','Четверг'] : ['Пт','Сб','Вс','Пн','Вт','Ср','Чт']
      // console.log('The year starts from 5')
      break

    case 6:
      names = full ? ['Суббота','Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница'] : ['Сб','Вс','Пн','Вт','Ср','Чт','Пт']
      // console.log('The year starts from 6')
      break
  }

  // @ts-ignore
  return names[this.getDay()]
}

Date.prototype.substractDays = function (count: number): void {
  this.setDate(this.getDate() - count)
}

Date.prototype.addDays = function(count: number): void {
  this.setDate(this.getDate() + count)
}
Date.prototype.getDDMMYY = function(): string {
  const dd = this.getDate().toString().padStart(2, '0')
  const mm = (this.getMonth() + 1).toString().padStart(2, '0')
  const yy = this.getFullYear()
  return dd + '.' + mm + '.' + yy
}

Date.prototype.isBARSDate = function(date: string): boolean {
  if(typeof date === 'undefined') {
    console.warn('date undefined!')
    return false
  }
  else{
    return (date as String).split(',').length === 2 && (date as String).split(' ').length === 3;
  }
}

Date.prototype.dateFromBarsFormat = function(date: string): Date{
  const T: any = {
    'января':   "01",
    'февраля':  "02",
    "марта":    "03",
    "апреля":   "04",
    "мая":      "05",
    "июня":     "06",
    "июля":     "07",
    "августа":  "08",
    "сентября": "09",
    "октября":  "10",
    "ноября":   "11",
    "декабря":  "12"
  }

  const parsedDate: string[] = date.split(',')[1].substring(1).split(' ')
  const year = new Date().getFullYear()
  let month: string= T[parsedDate[1]]
  const dateString = year.toString() + '-' + month + '-' + parsedDate[0]
  return new Date(dateString)
}


export{}
