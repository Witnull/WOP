import {
    App,
    Modal,
} from "obsidian";

export class PasswordModal extends Modal {
    private title: string;

    private submitText: string;

    private callback: (
        password: string,
    ) => Promise<boolean>;

    constructor(
        app: App,
        title: string,
        submitText: string,
        callback: (
            password: string,
        ) => Promise<boolean>,
    ) {
        super(app);

        this.title = title;
        this.submitText =
            submitText;
        this.callback =
            callback;
    }

    onOpen(): void {
        const {
            contentEl,
        } = this;

        contentEl.empty();

        contentEl.createEl(
            "h2",
            {
                text: this.title,
            },
        );

        const input =
            contentEl.createEl(
                "input",
                {
                    type: "password",
                },
            ) as HTMLInputElement;

        input.style.width =
            "100%";

        const error =
            contentEl.createDiv();

        const submit =
            contentEl.createEl(
                "button",
                {
                    text: this
                        .submitText,
                },
            );

        submit.onclick =
            async () => {
                const ok =
                    await this.callback(
                        input.value,
                    );

                if (ok) {
                    this.close();
                    return;
                }

                error.setText(
                    "Invalid password",
                );
            };

        input.focus();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export class ResetPasswordModal extends Modal {
    private callback: (
        password: string,
    ) => Promise<boolean>;

    constructor(
        app: App,
        callback: (
            password: string,
        ) => Promise<boolean>,
    ) {
        super(app);

        this.callback =
            callback;
    }

    onOpen(): void {
        const {
            contentEl,
        } = this;

        contentEl.empty();

        contentEl.createEl(
            "h2",
            {
                text: "Reset Password",
            },
        );

        const p1 =
            contentEl.createEl(
                "input",
                {
                    type: "password",
                },
            ) as HTMLInputElement;

        const p2 =
            contentEl.createEl(
                "input",
                {
                    type: "password",
                },
            ) as HTMLInputElement;

        p1.placeholder =
            "New password";

        p2.placeholder =
            "Confirm password";

        const error =
            contentEl.createDiv();

        const save =
            contentEl.createEl(
                "button",
                {
                    text: "Save",
                },
            );

        save.onclick =
            async () => {
                if (
                    p1.value !==
                    p2.value
                ) {
                    error.setText(
                        "Passwords do not match",
                    );
                    return;
                }

                if (
                    p1.value.length <
                    4
                ) {
                    error.setText(
                        "Password too short",
                    );
                    return;
                }

                const ok =
                    await this.callback(
                        p1.value,
                    );

                if (ok) {
                    this.close();
                }
            };
    }

    onClose(): void {
        this.contentEl.empty();
    }
}