export interface AntiedStorage {
    setting: {
        colorpick: boolean;
        customize: boolean;
        ingorelist: boolean;
        patches: boolean;
        text: boolean;
        timestamp: boolean;
    };
    switches: {
        customizeable: boolean;
        enableMD: boolean;
        enableMU: boolean;
        useBackgroundColor: boolean;
        useSemRawColors: boolean;
        ignoreBots: boolean;
        ignoreOwnMessages: boolean;
        minimalistic: boolean;
        alwaysAdd: boolean;
        darkMode: boolean;
        removeDismissButton: boolean;
        addTimestampForEdits: boolean;
        timestampStyle: "t" | "T" | "d" | "D" | "f" | "F" | "R";
        useEphemeralForDeleted: boolean;
        overrideIndicator: boolean;
        useIndicatorForDeleted: boolean;
        useCustomPluginName: boolean;
    };
    colors: {
        textColor: string;
        backgroundColor: string;
        backgroundColorAlpha: string;
        gutterColor: string;
        gutterColorAlpha: string;
        semRawColorPrefix: string;
    };
    inputs: {
        deletedMessageBuffer: string;
        editedMessageBuffer: string;
        historyToast: string;
        ignoredUserList: { id: string; username: string }[];
        customPluginName: string;
        customIndicator: string;
    };
    misc: {
        timestampPos: "BEFORE" | "AFTER";
        editHistoryIcon: string;
    };
    debug: boolean;
    debugUpdateRows: boolean;
}
