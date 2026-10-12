export class QuestionnairesRequiredError extends Error {
  constructor() { super('БАРС требует заполнить обязательные анкеты.'); this.name = 'QuestionnairesRequiredError'; }
}
export class UniversityAuthenticationRequiredError extends Error {
  constructor(public readonly mode: 'login' | '2FA') {
    super('Сессия БАРС завершилась. Войдите в аккаунт снова.');
    this.name = 'UniversityAuthenticationRequiredError';
  }
}
export class QuestionnaireOperationCancelledError extends Error {
  constructor() { super('Заполнение анкет остановлено.'); this.name = 'QuestionnaireOperationCancelledError'; }
}
