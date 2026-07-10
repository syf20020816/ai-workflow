import { NodeTypes } from '#/types'
import type { NodeType } from '#/types'
import { Brain } from 'lucide-react'
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
    children: <Brain height={height} width={width} color={color} {...rest} />,
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

Icon.Lark = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64z m0 832c-212.1 0-384-171.9-384-384s171.9-384 384-384 384 171.9 384 384-171.9 384-384 384z"
          fill="#1677ff"
        />
        <path
          d="M512 256c-38.4 0-64 25.6-64 64v192c0 38.4 25.6 64 64 64s64-25.6 64-64V320c0-38.4-25.6-64-64-64zM512 640c-38.4 0-64 25.6-64 64s25.6 64 64 64 64-25.6 64-64-25.6-64-64-64z"
          fill="#1677ff"
        />
      </svg>
    ),
  })

// ======== 新节点图标 ========

Icon.If = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M256 128h512a128 128 0 0 1 128 128v512a128 128 0 0 1-128 128H256a128 128 0 0 1-128-128V256a128 128 0 0 1 128-128z"
          fill="#fa8c16"
        />
        <path d="M384 640l128-256 128 256H384z" fill="#fff" />
        <path d="M448 576l64-128 64 128H448z" fill="#fa8c16" />
      </svg>
    ),
  })

Icon.IfCondition = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M192 512l320-320 320 320-320 320z"
          fill="#ff7a45"
          opacity="0.8"
        />
        <path d="M352 512l160-160 160 160-160 160z" fill="#fff" />
      </svg>
    ),
  })

Icon.Loop = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M512 128c-211.2 0-384 172.8-384 384h85.312c0-165.12 133.568-298.688 298.688-298.688s298.688 133.568 298.688 298.688-133.568 298.688-298.688 298.688v-85.312L384 810.688l128 128V896c211.2 0 384-172.8 384-384s-172.8-384-384-384z"
          fill="#1890ff"
        />
        <path d="M512 298.688l-85.312 85.312H512v-85.312z" fill="#1890ff" />
        <path d="M426.688 384L512 298.688 597.312 384z" fill="#1890ff" />
      </svg>
    ),
  })

Icon.LoopCondition = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path d="M256 896V128h512v768H256z" fill="#1890ff" opacity="0.6" />
        <path d="M384 768V256h256v512H384z" fill="#fff" />
        <path
          d="M512 384l85.312 85.312L512 554.624l-85.312-85.312z"
          fill="#1890ff"
        />
      </svg>
    ),
  })

Icon.Retry = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M880 112c-3.2 0-6.4 0-8 1.6L720 192c-3.2 1.6-4.8 4.8-4.8 8v128c-81.6-48-177.6-76.8-280-76.8-100.8 0-195.2 27.2-276.8 75.2C78.4 386.56 32 467.2 32 560c0 193.6 156.8 352 352 352 94.4 0 179.2-36.8 241.6-97.6 11.2-11.2 11.2-28.8 0-40-11.2-11.2-28.8-11.2-40 0-51.2 49.6-121.6 80-201.6 80-161.6 0-294.4-132.8-294.4-294.4 0-81.6 33.6-155.2 86.4-208 54.4-52.8 128-86.4 209.6-86.4 92.8 0 176 33.6 240 88H512c-3.2 0-6.4 1.6-8 4.8-1.6 3.2-1.6 6.4 0 8l120 152c3.2 3.2 8 4.8 12.8 3.2l136-72c3.2-1.6 4.8-4.8 4.8-9.6V128c0-8-6.4-16-16-16z"
          fill="#eb2f96"
        />
      </svg>
    ),
  })

Icon.Code = ({ ...rest }: SVGProps<SVGSVGElement>) =>
  Icon({
    children: (
      <svg
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        {...rest}
      >
        <path
          d="M320 256L64 512l256 256 64-64-192-192 192-192-64-64zM704 256l-64 64 192 192-192 192 64 64 256-256-256-256z"
          fill="#52c41a"
        />
        <path
          d="M576 224L448 800l64 64 128-576-64-64z"
          fill="#52c41a"
          opacity="0.7"
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
  [NodeTypes.IF, <Icon.If />],
  [NodeTypes.IF_CONDITION, <Icon.IfCondition />],
  [NodeTypes.LOOP, <Icon.Loop />],
  [NodeTypes.LOOP_CONDITION, <Icon.LoopCondition />],
  [NodeTypes.RETRY, <Icon.Retry />],
  [NodeTypes.CODE, <Icon.Code />],
])
