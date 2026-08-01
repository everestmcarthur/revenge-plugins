import { React, ReactNative } from "@vendetta/metro/common";
import { findByName } from "@vendetta/metro";
import { fetchPronouns, getCachedPronouns } from "../lib/pronounStore";

const { Text } = ReactNative;
const UserProfileSection = findByName("UserProfileSection", false);

export default function PronounSection({ userId }: { userId: string }) {
    const [pronouns, setPronouns] = React.useState(() => getCachedPronouns(userId));

    React.useEffect(() => fetchPronouns(userId, setPronouns), [userId]);

    if (!pronouns || !UserProfileSection) return null;

    return (
        <UserProfileSection title="Pronouns">
            <Text style={{ fontSize: 16 }}>{pronouns}</Text>
        </UserProfileSection>
    );
}
