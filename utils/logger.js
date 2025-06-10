const winston = require('winston');
const path = require('path');

// 로그 파일 경로 설정
const logDir = 'logs';
const errorLogPath = path.join(logDir, 'error.log');
const combinedLogPath = path.join(logDir, 'combined.log');

// 로그 포맷 설정
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// 로거 생성
const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        // 에러 로그는 별도 파일에 저장
        new winston.transports.File({ 
            filename: errorLogPath, 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // 모든 로그는 combined 파일에 저장
        new winston.transports.File({ 
            filename: combinedLogPath,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// 로그 레벨별 헬퍼 함수
const logHelper = {
    error: (message, meta = {}) => {
        logger.error(message, { ...meta, timestamp: new Date().toISOString() });
    },
    warn: (message, meta = {}) => {
        logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
    },
    info: (message, meta = {}) => {
        logger.info(message, { ...meta, timestamp: new Date().toISOString() });
    },
    debug: (message, meta = {}) => {
        logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
    }
};

module.exports = logHelper; 