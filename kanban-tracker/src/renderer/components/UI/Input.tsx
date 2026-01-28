import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <input
        className={`w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground
                   placeholder:text-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed
                   ${error ? 'border-destructive focus:ring-destructive' : ''}
                   ${className}`}
        {...props}
      />
      {hint && !error && (
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground
                   placeholder:text-muted-foreground resize-none
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed
                   ${error ? 'border-destructive focus:ring-destructive' : ''}
                   ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
