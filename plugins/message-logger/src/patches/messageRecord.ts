import { findByName, findByProps } from "@vendetta/metro";
import { after, instead } from "@vendetta/patcher";

const TAG = "[MessageLogger]";
const FAKE_DELETE_FLAG = "__msgLoggerDeleted";

// Discord wraps raw message JSON into a MessageRecord class before it reaches row generation - a
// plain custom field on the raw object doesn't reliably survive that wrap without this.
export function patchMessageRecord(cleanups: (() => void)[]): boolean {
    const MessageRecordUtils = findByProps("updateMessageRecord", "createMessageRecord");
    const MessageRecord = findByName("MessageRecord", false);

    if (!MessageRecordUtils || !MessageRecord) {
        console.warn(TAG, "MessageRecord module(s) not found - deleted messages may not render styled");
        return false;
    }

    try {
        cleanups.push(
            after("createMessageRecord", MessageRecordUtils, ([message]: any[], record: any) => {
                if (message?.[FAKE_DELETE_FLAG]) record[FAKE_DELETE_FLAG] = true;
            }),
        );

        cleanups.push(
            instead("updateMessageRecord", MessageRecordUtils, ([oldRecord, newRecord]: any[], orig: any) => {
                if (newRecord?.[FAKE_DELETE_FLAG]) {
                    return MessageRecordUtils.createMessageRecord(newRecord, oldRecord?.reactions);
                }
                return orig.apply(MessageRecordUtils, [oldRecord, newRecord]);
            }),
        );

        cleanups.push(
            after("default", MessageRecord, ([props]: any[], record: any) => {
                if (props?.[FAKE_DELETE_FLAG]) record[FAKE_DELETE_FLAG] = true;
            }),
        );
    } catch (e: any) {
        console.warn(TAG, "Failed to patch MessageRecord:", e?.message ?? e);
        return false;
    }

    return true;
}
