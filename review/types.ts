
export type ReviewState = "CHANGES_REQUESTED" | "COMMENTED" | "APPROVED";
export type CheckState = "PASS" | "FAIL" | "PENDING";
export interface Pr {
    author: {
        id: string;
        is_bot: boolean;
        login: string;
        name: string;
    };
    title: string;
    number: number;
    reviews: {
        id: string;
        author: {
            login: string;
        };
        authorAssociation: "MEMBER";
        body: string;
        submittedAt: string;
        includesCreatedEdit: boolean;
        reactionGroups: string[];
        state: ReviewState;
        commit: {
            oid: string;
        };
    }[];
    reviewRequests: {
        __typename: "User";
        login: string;
    }[];
    state: "OPEN" | "MERGED" | "CLOSED";
    headRefOid: string;
    updatedAt: string;
    createdAt: string;
    reviewDecision:
        | "REVIEW_REQUIRED"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "MY_REVIEW_REQUIRED"
        | "DRAFT"; // not really fix later
    mergeStateStatus: "DIRTY" | "BLOCKED" | "BEHIND" | "UNKNOWN";
    statusCheckRollup: {
        __typename: "CheckRun";
        conclusion: "FAILURE" | "SUCCESS" | "NEUTRAL" | null;
        status: "COMPLETED" | "PENDING" | null;
        name: string;
    }[];
    mergedAt: string | null;
    closedAt: string | null;
    isDraft: boolean;
}
