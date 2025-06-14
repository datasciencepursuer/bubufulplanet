import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          /* Old purple focus ring - commented for future use
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          */
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-800 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          {
            "gradient-bg text-white shadow-lg hover:shadow-xl hover:scale-105":
              variant === "default",
            "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:scale-105":
              variant === "destructive",
            /* Old purple outline - commented for future use
            "border-2 border-purple-200 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-purple-50 hover:border-purple-300":
              variant === "outline",
            */
            "border-2 border-teal-200 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-teal-50 hover:border-teal-300":
              variant === "outline",
            "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-900 shadow-sm hover:shadow-md":
              variant === "secondary",
            /* Old purple ghost - commented for future use
            "hover:bg-purple-50 hover:text-purple-900":
              variant === "ghost",
            */
            "hover:bg-teal-50 hover:text-teal-900":
              variant === "ghost",
            /* Old purple link - commented for future use
            "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 underline-offset-4 hover:underline":
              variant === "link",
            */
            "text-transparent bg-clip-text bg-gradient-to-r from-teal-800 to-teal-600 underline-offset-4 hover:underline":
              variant === "link",
          },
          {
            "h-10 px-6 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-12 rounded-lg px-8 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }