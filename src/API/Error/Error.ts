type BARSErrorCode =
    'OK' |
    'UNKNOWN' |
    'STUDENT_INFO_PARSER_FAIL' |
    'MARK_TABLE_PARSER_FAIL' |
    'SKIPPED_CLASSES_PARSER_FAIL' |
    'RECORDS_PARSER_FAIL' |
    'REPORTS_PARSER_FAIL' |
    'QUESTIONNAIRES_PARSER_FAIL' |
    'TASKS_PARSER_FAIL' |
    'STIPENDS_PARSER_FAIL' |
    'ORDERS_PARSER_FAIL' |
    'INVALID_CREDS' |
    'SERVER_ERROR' |
    'SEMESTER_FILTER_FAIL' |
    'SCHEDULE_PARSER_FAIL'|
    'LOGIN_FAIL'|
    'INVALID_REQUEST_SCHEDULE'


export interface BARSError{
    error: BARSErrorCode,
    message: string
    BARS_ERROR_IDENTIFIER: 'I_AM_A_BARS_ERROR'
}

export const isBARSError = (obj: any): obj is BARSError => {
    return obj.BARS_ERROR_IDENTIFIER === 'I_AM_A_BARS_ERROR'
}

export const CreateBARSError = (error: BARSErrorCode, message?: string): BARSError => ({
    error,
    message: typeof message != 'undefined' ? message : '',
    BARS_ERROR_IDENTIFIER: 'I_AM_A_BARS_ERROR'
})
