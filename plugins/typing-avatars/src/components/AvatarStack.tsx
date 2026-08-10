import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { getTypingAvatarURL } from "../lib/avatarUrl";

const SIZE = 20;
const OVERLAP = 8;

// No text label and no tap handler by design - purely decorative avatars replacing the
// "X is typing..." text entirely. If a lot of people are typing, this wraps to a second
// overlapping row rather than clipping or capping with a "+N" badge.
export default function AvatarStack({ typingUserIds, guildId }: { typingUserIds: string[]; guildId: string | undefined }) {
    if (!typingUserIds?.length) return null;

    return (
        <View style={st.row}>
            {typingUserIds.map((userId, i) => {
                const uri = getTypingAvatarURL(guildId, userId, SIZE);
                if (!uri) return null;
                return (
                    <Image
                        key={userId}
                        source={{ uri }}
                        style={[st.avatar, i > 0 ? st.overlap : null]}
                    />
                );
            })}
        </View>
    );
}

const st = StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
    avatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
    overlap: { marginLeft: -OVERLAP },
});
