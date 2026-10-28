import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
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

function ForgotPasswordFormInner({ serverError }: Pick<Props, "serverError">) {
  const { t } = useLocale();
  const [errors, setErrors] = useState<{ email?: string }>({});

  function validate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = formValue(fd, "email").trim();

    const next: typeof errors = {};
    if (!email) {
      next.email = t("auth.validation.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("auth.validation.email_invalid");
    }
    return next;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next = validate(e.currentTarget);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/forgot-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={t("auth.field.email")}
        theme="paper"
        uncontrolled
        onInput={() => {
          if (errors.email) setErrors({});
        }}
        placeholder={t("auth.placeholder.email")}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} theme="paper" />

      <SubmitButton pendingText={t("auth.button.send_reset_link_pending")} icon={<Send className="size-4" />}>
        {t("auth.button.send_reset_link")}
      </SubmitButton>
    </form>
  );
}

export default function ForgotPasswordForm({ locale, serverError }: Props) {
  return (
    <LocaleProvider locale={locale}>
      <ForgotPasswordFormInner serverError={serverError} />
    </LocaleProvider>
  );
}
