"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
};

export function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  maxLength = 1024,
  required = true,
  placeholder,
  helpText
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="password-field">
      {label}
      <span className="password-input-wrap">
        <input
          name={name}
          type={visible ? "text" : "password"}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
        />
        <button
          className="password-toggle"
          data-no-loading="true"
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? "Hide" : "Show"}
        </button>
      </span>
      {helpText && <span className="help-text">{helpText}</span>}
    </label>
  );
}
