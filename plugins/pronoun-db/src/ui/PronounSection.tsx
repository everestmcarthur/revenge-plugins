import { React, ReactNative } from "@vendetta/metro/common";
import { findByName } from "@vendetta/metro";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { fetchPronouns, getCachedPronouns } from "../lib/pronounStore";

const { Text } = ReactNative;
const UserProfileSection = findByName("UserProfileSection", false);

export default function PronounSection({ userId }: { userId: string }) {
    const [pronouns, setPronouns] = React.useState(() => getCachedPronouns(userId));

    React.useEffect(() => fetchPronouns(userId, setPronouns), [userId]);

    if (!pronouns || !UserProfileSection) return null;

    // RN's Text defaults to black with no theming - illegible on Discord's dark theme otherwise.
    const textColor = resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1");

    return (
        <UserProfileSection title="Pronouns">
            <Text style={{ fontSize: 16, color: textColor }}>{pronouns}</Text>
        </UserProfileSection>
    );
}
