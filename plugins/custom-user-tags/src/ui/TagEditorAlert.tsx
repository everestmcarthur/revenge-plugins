import { React, ReactNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { TextInput } from "@shared/ui/table";
import { showToast } from "@vendetta/ui/toasts";
import ColorInput from "./ColorInput";
import IconPicker from "./IconPicker";
import { getUserTag, setUserTag, removeUserTag } from "../lib/tags";

const { View } = ReactNative;

const ALERT_KEY = "custom-user-tags-editor";

// Looked up lazily (not at module scope) since this repo hasn't needed Discord's native alert system
// before - safer to resolve it right when actually opening the editor than to risk an early miss at
// plugin-load time getting permanently cached.
function alertParts() {
    const alerts = findByProps("openAlert", "dismissAlert") as any;
    const modal = findByProps("AlertModal", "AlertActions") as any;
    return {
        openAlert: alerts?.openAlert,
        dismissAlert: alerts?.dismissAlert,
        AlertModal: modal?.AlertModal,
        AlertActions: modal?.AlertActions,
        AlertActionButton: modal?.AlertActionButton
    };
}

function TagEditor({ userId, username }: { userId: string; username: string }) {
    const existing = getUserTag(userId);
    const [text, setText] = React.useState(existing?.text ?? "");
    const [color, setColor] = React.useState(existing?.color ?? "#5865F2");
    const [icon, setIcon] = React.useState(existing?.icon ?? "none");
    const { dismissAlert, AlertModal, AlertActions, AlertActionButton } = alertParts();

    if (!AlertModal || !AlertActions || !AlertActionButton) return null;

    const save = () => {
        if (!text.trim() && icon === "none") {
            showToast("Enter some tag text or choose an icon first", undefined);
            return;
        }
        setUserTag(userId, { text: text.trim(), color, icon: icon === "none" ? undefined : icon });
        showToast(`Tagged ${username}`, undefined);
        dismissAlert?.(ALERT_KEY);
    };

    const remove = () => {
        removeUserTag(userId);
        showToast(`Removed ${username}'s tag`, undefined);
        dismissAlert?.(ALERT_KEY);
    };

    return (
        <AlertModal
            title={`Tag ${username}`}
            content={
                <View>
                    <TextInput label="Tag text" placeholder="e.g. FRIEND" value={text} onChange={setText} />
                    <IconPicker title="Icon" value={icon} onChange={setIcon} color={color} />
                    <ColorInput title="Color" value={color} onChange={setColor} />
                </View>
            }
            actions={
                <AlertActions>
                    <AlertActionButton text="Save" variant="primary" onPress={save} />
                    {existing && <AlertActionButton text="Remove tag" variant="secondary" onPress={remove} />}
                    <AlertActionButton text="Cancel" variant="secondary" />
                </AlertActions>
            }
        />
    );
}

export default function openTagEditor(userId: string, username: string): void {
    const { openAlert } = alertParts();
    if (!openAlert) {
        showToast("Couldn't open the tag editor - alert system not found", undefined);
        return;
    }
    openAlert(ALERT_KEY, <TagEditor userId={userId} username={username} />);
}
