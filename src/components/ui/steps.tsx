
import * as React from "react"
import { cn } from "@/lib/utils"

interface StepsProps extends React.HTMLAttributes<HTMLDivElement> {
  currentStep?: number
}

export const Steps = ({ 
  children, 
  currentStep = 1, 
  className, 
  ...props 
}: StepsProps) => {
  const steps = React.Children.toArray(children)
  const totalSteps = steps.length

  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <React.Fragment key={index}>
            <div 
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium border transition-colors",
                index + 1 === currentStep ? 
                  "border-primary bg-primary text-primary-foreground" : 
                  index + 1 < currentStep ?
                    "border-primary bg-primary/10 text-primary" :
                    "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {index + 1}
            </div>
            {index < totalSteps - 1 && (
              <div 
                className={cn(
                  "h-1 flex-1 transition-colors",
                  index + 1 < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div>
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child) && index + 1 === currentStep) {
            return child
          }
          return null
        })}
      </div>
    </div>
  )
}

interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
}

export const Step = ({ 
  title, 
  children, 
  className, 
  ...props 
}: StepProps) => {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium leading-none">{title}</h4>
      {children}
    </div>
  )
}
