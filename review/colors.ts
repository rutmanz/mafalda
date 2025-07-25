import { ReviewDecision } from "./prStatus";

export const colorMsg = {
    APPROVED: "\x1b[32mAPPROVED\x1b[0m",
    CHANGES_REQUESTED: "\x1b[31mCHANGES_REQUESTED\x1b[0m",
    CURRENT: "\x1b[34mCURRENT\x1b[0m",
    STANDING: "\x1b[34mSTANDING\x1b[0m",
    OUTDATED: "\x1b[33mOUTDATED\x1b[0m",
    PENDING: "\x1b[33mPENDING\x1b[0m",
    REQUESTED: "\x1b[90mREQUESTED\x1b[0m",
    COMMENTED: "\x1b[90mCOMMENTED\x1b[0m",
} as const;

export enum CheckStatus {
    PASS,
    FAIL,
    PENDING,
}

export enum MergabilityStatus {
    CONFLICTS,
    BEHIND,
    CLEAN,
}

export const decisionColors: Record<ReviewDecision, string> = {
    [ReviewDecision.APPROVED]: "\x1b[42m",
    [ReviewDecision.CHANGES_REQUESTED]: "\x1b[41m",
    [ReviewDecision.REVIEW_REQUIRED]: "\x1b[43m",
    [ReviewDecision.MY_REVIEW_REQUIRED]: "\x1b[45m",
    [ReviewDecision.DRAFT]: "\x1b[100m",
};
