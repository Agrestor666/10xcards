import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import type { AppLocale } from "@/lib/locale";

interface Props {
  locale: AppLocale;
  serverError?: string | null;
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function SignInFormInner({ serverError }: Pick<Props, "serverError">) {
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = formValue(fd, "email").trim();
    const password = formValue(fd, "password");

    const next: typeof errors = {};
    if (!email) {
      next.email = t("auth.validation.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("auth.validation.email_invalid");
    }
    if (!password) {
      next.password = t("auth.validation.password_required");
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

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        onInput={() => {
          clearError("password");
        }}
        placeholder={t("auth.placeholder.password")}
        error={errors.password}
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

      <ServerError message={serverError} theme="paper" />

      <SubmitButton pendingText={t("auth.button.sign_in_pending")} icon={<LogIn className="size-4" />}>
        {t("auth.button.sign_in")}
      </SubmitButton>
    </form>
  );
}

export default function SignInForm({ locale, serverError }: Props) {
  return (
    <LocaleProvider locale={locale}>
      <SignInFormInner serverError={serverError} />
    </LocaleProvider>
  );
}
