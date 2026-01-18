import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import styles from "./ui.module.css";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: Variant;
  size?: Size;
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function buttonClass(variant: Variant, size: Size, className?: string) {
  return cx(
    styles.button,
    variant === "primary" && styles.buttonPrimary,
    variant === "danger" && styles.buttonDanger,
    variant === "ghost" && styles.buttonGhost,
    size === "sm" && styles.buttonSm,
    size === "lg" && styles.buttonLg,
    className
  );
}

export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: Props) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function IconButton({
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size">) {
  return <button type={type} className={cx(styles.iconButton, className)} {...props} />;
}

type LinkButtonProps = Omit<LinkProps, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function LinkButton({ variant = "default", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

type ExternalButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "size"> & {
  variant?: Variant;
  size?: Size;
};

export function ExternalButton({
  variant = "default",
  size = "md",
  className,
  ...props
}: ExternalButtonProps) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}
