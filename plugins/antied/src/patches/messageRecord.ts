import { after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";

const MessageRecordUtils = findByProps("updateMessageRecord", "createMessageRecord");

export function patchMessageRecord(isEnabledRef: { current: boolean }): () => void {
    if (!MessageRecordUtils) return () => {};

    const cleanups: (() => void)[] = [];

    cleanups.push(
        after("createMessageRecord", MessageRecordUtils, function ([message], record) {
            if (isEnabledRef.current && (message?.was_deleted || record?.was_deleted)) {
                if (record) record.was_deleted = true;
            }
        })
    );

    cleanups.push(
        after("updateMessageRecord", MessageRecordUtils, function ([oldRecord, newRecord], record) {
            if (isEnabledRef.current && (oldRecord?.was_deleted || newRecord?.was_deleted)) {
                if (record) record.was_deleted = true;
            }
        })
    );

    if (typeof MessageRecordUtils.updateServerMessage === "function") {
        cleanups.push(
            after("updateServerMessage", MessageRecordUtils, function ([oldRecord, newRecord], record) {
                if (isEnabledRef.current && (oldRecord?.was_deleted || newRecord?.was_deleted)) {
                    if (record) record.was_deleted = true;
                }
            })
        );
    }

    return () => {
        for (const fn of cleanups) fn();
    };
}
