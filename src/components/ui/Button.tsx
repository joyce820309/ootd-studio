import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'oat' | 'secondary' | 'ghost' | 'danger' | 'sage'
type Size = 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper border-transparent hover:bg-ink-2',
  oat: 'bg-oat text-ink border-oat-edge hover:bg-oat-edge',
  secondary: 'bg-card text-ink border-line-strong hover:border-ink-3',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-tile',
  danger: 'bg-rose-deep text-white border-transparent hover:bg-rose-ink',
  sage: 'bg-sage-deep text-white border-transparent hover:bg-sage-ink',
}
const SIZE: Record<Size, string> = {
  md: 'h-11 px-[18px] text-sm',
  lg: 'h-[50px] px-[22px] text-[15px]',
}

const buttonClass = (variant: ButtonVariant = 'secondary', size: Size = 'md', extra = '') =>
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn border-[1.5px] font-medium no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${extra}`

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: Size
}

export function Button({ variant, size, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: Size
}

export function ButtonLink({ variant, size, className = '', ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
