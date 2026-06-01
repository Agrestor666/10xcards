import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import type { AppLocale } from "@/lib/locale";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  locale: AppLocale;
  serverError?: string | null;
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function SignUpFormInner({ serverError }: Pick<Props, "serverError">) {
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [passwordLengthHint, setPasswordLengthHint] = useState(0);

  function validate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = formValue(fd, "email").trim();
    const password = formValue(fd, "password");
    const confirmPassword = formValue(fd, "confirmPassword");

    const next: typeof errors = {};

    if (!email) {
      next.email = t("auth.validation.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("auth.validation.email_invalid");
    }

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
        {t(
          remaining === 1 ? "auth.validation.password_chars_needed_one" : "auth.validation.password_chars_needed_other",
          {
            count: remaining,
          },
        )}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={t("auth.field.email")}
        theme="paper"
        uncontrolled
        onInput={() => {
          clearError("email");
        }}
        placeholder={t("auth.placeholder.email")}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

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

      <SubmitButton pendingText={t("auth.button.create_account_pending")} icon={<UserPlus className="size-4" />}>
        {t("auth.button.create_account")}
      </SubmitButton>
    </form>
  );
}

export default function SignUpForm({ locale, serverError }: Props) {
  return (
    <LocaleProvider locale={locale}>
      <SignUpFormInner serverError={serverError} />
    </LocaleProvider>
  );
}
