import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import styles from "./ui.module.css";

// =============================================================================
// Types
// =============================================================================

/**
 * Visual variants supported by the UI stylesheet.
 * Keep this in sync with `ui.module.css`.
 */
type Variant = "default" | "primary" | "danger" | "ghost";

/**
 * Button sizing supported by the UI stylesheet.
 * Keep this in sync with `ui.module.css`.
 */
type Size = "sm" | "md" | "lg";

/**
 * Base props for the standard <button> component.
 * We omit the native `size` attribute because we use our own `Size` union instead.
 */
type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: Variant;
  size?: Size;
};

/**
 * Props for the internal navigation button (<Link> from react-router).
 */
type LinkButtonProps = Omit<LinkProps, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
};

/**
 * Props for external navigation buttons (<a>).
 * We omit native `size` to avoid confusion with the component `size` prop.
 */
type ExternalButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "size"> & {
  variant?: Variant;
  size?: Size;
};

// =============================================================================
// Styling helpers
// =============================================================================

/**
 * Minimal className combiner:
 * - ignores falsy values
 * - joins with spaces
 */
function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Builds a className string based on:
 * - shared base button style
 * - variant modifiers
 * - size modifiers
 * - optional caller-provided classes
 */
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

// =============================================================================
// Components
// =============================================================================

/**
 * Standard button component for in-app actions.
 *
 * Notes:
 * - Defaults `type="button"` to avoid accidental form submissions.
 * - Passes through all other native button props (onClick, disabled, aria-*, etc.).
 */
export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/**
 * Compact icon-only button.
 *
 * Use when the visual treatment differs from the standard button (e.g. circular icon button).
 * Accepts standard button props and allows overriding with an extra className.
 */
export function IconButton({
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size">) {
  return <button type={type} className={cx(styles.iconButton, className)} {...props} />;
}

/**
 * Internal navigation button using react-router's <Link>.
 *
 * Use this for navigation within the SPA (keeps client-side routing, avoids full reload).
 */
export function LinkButton({
  variant = "default",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/**
 * External navigation button rendered as an <a>.
 *
 * Typical use:
 * - external URLs
 * - downloads
 * - "open in new tab" flows
 *
 * Consider adding `target="_blank"` and `rel="noreferrer"` at call sites when appropriate.
 */
export function ExternalButton({
  variant = "default",
  size = "md",
  className,
  ...props
}: ExternalButtonProps) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}