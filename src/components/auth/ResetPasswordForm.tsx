import React, { useState } from "react";
import { Lock } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-recovery";
import type { AppLocale } from "@/lib/locale";

function passwordCharsNeededKey(remaining: number) {
  if (remaining === 1) {
    return "auth.validation.password_chars_needed_one" as const;
  }
  if (remaining >= 2 && remaining <= 4) {
    return "auth.validation.password_chars_needed_other" as const;
  }
  return "auth.validation.password_chars_needed_many" as const;
}

interface Props {
  locale: AppLocale;
  serverError?: string | null;
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function ResetPasswordFormInner({ serverError }: Pick<Props, "serverError">) {
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [passwordLengthHint, setPasswordLengthHint] = useState(0);

  function validate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const password = formValue(fd, "password");
    const confirmPassword = formValue(fd, "confirmPassword");

    const next: typeof errors = {};

    if (!password) {
      next.password = t("auth.validation.password_required");
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t("auth.validation.password_min", { min: MIN_PASSWORD_LENGTH });
    }

    if (!confirmPassword) {
      next.confirmPassword = t("auth.validation.confirm_required");
    } else if (password !== confirmPassword) {
      next.confirmPassword = t("auth.validation.password_mismatch");
    }

    return next;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next = validate(e.currentTarget);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      e.preventDefault();
    }
  }

  const remaining = MIN_PASSWORD_LENGTH - passwordLengthHint;
  const passwordHint =
    !errors.password && passwordLengthHint > 0 && passwordLengthHint < MIN_PASSWORD_LENGTH ? (
      <p className="text-muted-foreground mt-1 text-xs">
        {t(passwordCharsNeededKey(remaining), {
          count: remaining,
        })}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/reset-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="password"
        label={t("auth.field.password")}
        theme="paper"
        uncontrolled
        passwordVisible={showPassword}
        onInput={(e) => {
          clearError("password");
          setPasswordLengthHint(e.currentTarget.value.length);
        }}
        placeholder={t("auth.placeholder.password_min")}
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            theme="paper"
            visible={showPassword}
            onToggle={() => {
              setShowPassword((prev) => !prev);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label={t("auth.field.confirm_password")}
        theme="paper"
        uncontrolled
        passwordVisible={showConfirmPassword}
        onInput={() => {
          clearError("confirmPassword");
        }}
        placeholder={t("auth.placeholder.confirm_password")}
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            theme="paper"
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword((prev) => !prev);
            }}
          />
        }
      />

      <ServerError message={serverError} theme="paper" />

      <SubmitButton pendingText={t("auth.button.update_password_pending")} icon={<Lock className="size-4" />}>
        {t("auth.button.update_password")}
      </SubmitButton>
    </form>
  );
}

export default function ResetPasswordForm({ locale, serverError }: Props) {
  return (
    <LocaleProvider locale={locale}>
      <ResetPasswordFormInner serverError={serverError} />
    </LocaleProvider>
  );
}
