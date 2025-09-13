import winston from "winston";
import "winston-daily-rotate-file";

const development = process.env.NODE_ENV?.toLowerCase() !== "production";
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: "./.log/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "14d",
    }),
    new winston.transports.DailyRotateFile({
      filename: "./.log/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "10m",
      maxFiles: "14d",
      level: "error",
    }),
    ...(development
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          }),
        ]
      : [
          new winston.transports.Console({
            format: winston.format.json(),
          }),
        ]),
  ],
});
