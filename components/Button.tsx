import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "strong";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

export function buttonClass(variant: Variant = "primary", small = false) {
  return `btn btn-${variant}${small ? " btn-sm" : ""}`;
}

export default function Button({
  variant = "primary",
  small = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, small)} ${className}`.trim()}
      {...rest}
    />
  );
}
