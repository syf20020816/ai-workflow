import { NodeTypes } from '.'
import { v4 as uuidv4 } from 'uuid'
import type { AppNode } from '.'

type Position = { x: number; y: number }

export class NodeBuilder {
  private static basicProps(x: number, y: number = 0) {
    return {
      id: uuidv4(),
      position: { x: x + 200, y },
      deletable: true,
      draggable: true,
      dragging: false,
      selectable: true,
      selected: false,
      zIndex: 1,
      isConnectable: true,
      positionAbsoluteX: x + 200,
      positionAbsoluteY: y,
    }
  }

  static userInput(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.USER_INPUT,
      data: {
        title: '用户输入节点',
        input: { label: '' },
      },
    }
  }

  static agent(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.AGENT,
      data: {
        title: '智能体节点',
        modal: {},
      },
    }
  }

  static aiOutput(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.AI_OUTPUT,
      data: {
        title: 'AI输出节点',
      },
    }
  }

  static answer(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.ANSWER,
      data: {
        title: '回答节点',
      },
    }
  }

  static bmadAgent(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.BMAD_AGENT,
      data: {
        title: 'BMad角色节点',
      },
    }
  }

  static lark(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.LARK,
      data: {
        title: 'Lark文档节点',
      },
    }
  }

  // ======== 控制节点 ========

  static ifNode(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.IF,
      data: {
        title: '判断节点',
        expression: '',
      },
    }
  }

  static ifCondition(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.IF_CONDITION,
      data: {
        title: '条件分支节点',
        condition: '',
        label: '',
      },
    }
  }

  static loop(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.LOOP,
      data: {
        title: '循环节点',
        maxLoopCount: 5,
        condition: '',
      },
    }
  }

  static loopCondition(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.LOOP_CONDITION,
      data: {
        title: '循环条件节点',
        condition: '',
      },
    }
  }

  static retry(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.RETRY,
      data: {
        title: '重试节点',
        retryDelay: 1,
        maxRetryCount: 5,
        judgmentMode: 'manual',
        errorKeywords: '',
      },
    }
  }

  static code(pos: Position): AppNode {
    return {
      ...NodeBuilder.basicProps(pos.x, pos.y),
      type: NodeTypes.CODE,
      data: {
        title: '代码访问节点',
        mode: 'local',
        repoUrl: '',
        branch: 'master',
      },
    }
  }
}
