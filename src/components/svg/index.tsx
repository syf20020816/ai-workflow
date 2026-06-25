import { NodeTypes } from '#/types'
import type { NodeType } from '#/types'
import type { ReactNode, SVGProps } from 'react'

export const Icon = ({ children }: { children: ReactNode }) => {
  return children
}

Icon.Arrow = ({
  height = 24,
  width = 24,
  color = 'currentColor',
  strokeWidth = 4,
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        width={width}
        height={height}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        color={color}
        {...rest}
      >
        <path
          d="M19 12L31 24L19 36"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  })

Icon.Leave = ({
  height = 24,
  width = 24,
  color,
  strokeWidth = 4,
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        width={width}
        height={height}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        color={color}
        {...rest}
      >
        <path
          d="M23.9917 6H6V42H24"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M33 33L42 24L33 15"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 23.9917H42"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  })

Icon.UserInput = ({
  height = 24,
  width = 24,
  color = '#10a6f5',
  strokeWidth = 4,
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        p-id="11196"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M284.444444 0h455.111112a284.444444 284.444444 0 0 1 284.444444 284.444444v455.111112a284.444444 284.444444 0 0 1-284.444444 284.444444H284.444444a284.444444 284.444444 0 0 1-284.444444-284.444444V284.444444a284.444444 284.444444 0 0 1 284.444444-284.444444z m56.888889 378.595556h132.266667v337.521777h70.997333V378.595556h132.266667V312.888889H341.333333v65.706667z"
          fill={color}
          p-id="11197"
        ></path>
      </svg>
    ),
  })

export const NodeIcons = new Map<NodeType, ReactNode>([
  [NodeTypes.USER_INPUT, <Icon.UserInput />],
])
