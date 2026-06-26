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

Icon.Agent = ({
  height = 24,
  width = 24,
  color = '#722ed1',
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M942.08 450.56a163.84 163.84 0 0 0-81.92-142.5408A122.88 122.88 0 0 0 860.16 286.72a122.88 122.88 0 0 0-122.88-122.88h-7.3728A122.88 122.88 0 0 0 532.48 113.8688 122.88 122.88 0 0 0 335.0528 163.84H327.68a122.88 122.88 0 0 0-122.88 122.88 122.88 122.88 0 0 0 0 21.2992 163.84 163.84 0 0 0-22.528 269.9264A163.84 163.84 0 0 0 327.68 819.2h7.3728A122.88 122.88 0 0 0 532.48 869.1712 122.88 122.88 0 0 0 729.9072 819.2H737.28a163.84 163.84 0 0 0 143.36-241.2544A163.84 163.84 0 0 0 942.08 450.56zM491.52 350.208a193.3312 193.3312 0 0 0-27.8528-13.1072 41.04192 41.04192 0 0 0-26.2144 77.824A81.92 81.92 0 0 1 491.52 491.52v63.488a193.3312 193.3312 0 0 0-27.8528-13.1072 41.04192 41.04192 0 0 0-26.2144 77.824A81.92 81.92 0 0 1 491.52 696.32v81.92a40.96 40.96 0 0 1-40.96 40.96 40.96 40.96 0 0 1-37.2736-24.576 166.7072 166.7072 0 0 0 19.6608-13.5168 41.00096 41.00096 0 1 0-52.4288-63.0784A81.92 81.92 0 0 1 245.76 655.36a81.92 81.92 0 0 1 13.1072-43.4176c9.17504 1.6384 18.51392 2.4576 27.8528 2.4576a40.96 40.96 0 1 0 0-81.92 75.3664 75.3664 0 0 1-28.2624-5.3248A81.92 81.92 0 0 1 245.76 378.88a126.976 126.976 0 0 0 18.8416 14.336 41.08288 41.08288 0 0 0 40.96-71.2704 36.864 36.864 0 0 1-13.9264-13.5168A37.6832 37.6832 0 0 1 286.72 286.72a40.96 40.96 0 0 1 40.96-40.96 31.1296 31.1296 0 0 1 8.6016 0c2.17088 6.5536 4.75136 13.02528 7.7824 19.2512a40.96 40.96 0 0 0 56.1152 15.1552 40.96 40.96 0 0 0 14.7456-54.8864A43.4176 43.4176 0 0 1 409.6 204.8a40.96 40.96 0 1 1 81.92 0v145.408z m314.9824 176.9472A75.3664 75.3664 0 0 1 778.24 532.48a40.96 40.96 0 0 0 0 81.92c9.33888 0 18.67776-0.8192 27.8528-2.4576A81.92 81.92 0 0 1 819.2 655.36a81.92 81.92 0 0 1-134.7584 62.6688 41.00096 41.00096 0 0 0-52.4288 63.0784c6.22592 4.95616 12.77952 9.50272 19.6608 13.5168a40.96 40.96 0 0 1-37.2736 24.576 40.96 40.96 0 0 1-40.96-40.96v-81.92a81.92 81.92 0 0 1 54.0672-76.5952 41.04192 41.04192 0 0 0-26.2144-77.824 193.3312 193.3312 0 0 0-27.8528 13.1072V491.52a81.92 81.92 0 0 1 54.0672-76.5952 41.04192 41.04192 0 0 0-26.2144-77.824 193.3312 193.3312 0 0 0-27.8528 13.1072V204.8a40.96 40.96 0 0 1 81.92 0 43.4176 43.4176 0 0 1-5.3248 20.48 40.96 40.96 0 1 0 70.8608 40.96 157.696 157.696 0 0 0 7.7824-20.48 31.1296 31.1296 0 0 1 8.6016 0 40.96 40.96 0 0 1 40.96 40.96 40.96 40.96 0 0 1-6.9632 22.528 36.864 36.864 0 0 1-13.5168 12.6976 41.08288 41.08288 0 0 0 40.96 71.2704 108.9536 108.9536 0 0 0 20.48-14.336 81.92 81.92 0 0 1-11.0592 148.2752h-1.6384z"
          fill={color}
          p-id="12575"
        ></path>
      </svg>
    ),
  })

Icon.AIOutput = ({
  height = 24,
  width = 24,
  color = '#52c41a',
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M128 192h768v64H128zM128 384h768v64H128zM128 576h512v64H128zM128 768h640v64H128z"
          fill={color}
        />
        <path d="M768 704l128 128-128 128V704z" fill={color} />
      </svg>
    ),
  })

Icon.Answer = ({
  height = 24,
  width = 24,
  color = '#fa8c16',
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M512 128c-211.2 0-384 172.8-384 384 0 76.8 25.6 147.2 64 204.8L128 896l179.2-57.6c57.6 38.4 128 64 204.8 64 211.2 0 384-172.8 384-384S723.2 128 512 128z m0 704c-64 0-121.6-19.2-172.8-44.8L256 832l44.8-83.2c-25.6-51.2-44.8-108.8-44.8-172.8 0-176 140.8-320 320-320s320 144 320 320-140.8 320-320 320z"
          fill={color}
        />
        <path
          d="M448 512m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z"
          fill={color}
        />
        <path
          d="M576 512m-32 0a32 32 0 1 0 64 0 32 32 0 1 0-64 0Z"
          fill={color}
        />
      </svg>
    ),
  })

Icon.BMadAgent = ({
  height = 24,
  width = 24,
  color = '#eb2f96',
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M512 64C300.8 64 128 236.8 128 448c0 124.8 60.8 236.8 153.6 307.2V896c0 35.2 28.8 64 64 64h332.8c35.2 0 64-28.8 64-64V755.2C835.2 684.8 896 572.8 896 448 896 236.8 723.2 64 512 64z m0 768c-176 0-320-144-320-320s144-320 320-320 320 144 320 320-144 320-320 320z"
          fill={color}
        />
        <path
          d="M512 320c-70.4 0-128 57.6-128 128s57.6 128 128 128 128-57.6 128-128-57.6-128-128-128z"
          fill={color}
        />
        <path
          d="M640 640c-70.4-38.4-147.2-57.6-230.4-57.6S307.2 601.6 236.8 640c-19.2 12.8-32 38.4-32 57.6V832c0 19.2 12.8 32 32 32h614.4c19.2 0 32-12.8 32-32V697.6c0-25.6-12.8-44.8-32-57.6z"
          fill={color}
        />
      </svg>
    ),
  })

Icon.Lark = ({
  height = 24,
  width = 24,
  color = '#1677ff',
  ...rest
}: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        {...rest}
      >
        <path
          d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 832c-212.1 0-384-171.9-384-384s171.9-384 384-384 384 171.9 384 384-171.9 384-384 384z"
          fill={color}
        />
        <path
          d="M512 256c-38.4 0-64 25.6-64 64v192c0 38.4 25.6 64 64 64s64-25.6 64-64V320c0-38.4-25.6-64-64-64zM512 640c-38.4 0-64 25.6-64 64s25.6 64 64 64 64-25.6 64-64-25.6-64-64-64z"
          fill={color}
        />
      </svg>
    ),
  })

export const NodeIcons = new Map<NodeType, ReactNode>([
  [NodeTypes.USER_INPUT, <Icon.UserInput />],
  [NodeTypes.AGENT, <Icon.Agent />],
  [NodeTypes.ANSWER, <Icon.Answer />],
  [NodeTypes.AI_OUTPUT, <Icon.AIOutput />],
  [NodeTypes.BMAD_AGENT, <Icon.BMadAgent />],
  [NodeTypes.LARK, <Icon.Lark />],
])
