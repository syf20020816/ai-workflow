import { Button } from 'antd'
import styles from '../index.module.scss'
import { PlayIcon } from '@radix-ui/react-icons'

export const RunNode = () => {
  return (
    <Button
      type="primary"
      size="small"
      className={styles.run_button}
      styles={{
        root: {
          height: 12,
          width: 12,
        },
      }}
      icon={<PlayIcon height={8} width={8}></PlayIcon>}
    ></Button>
  )
}
