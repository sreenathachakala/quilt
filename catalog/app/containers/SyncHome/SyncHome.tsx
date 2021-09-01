import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import BucketSelect from 'containers/NavBar/BucketSelect'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: t.spacing(60),
    justifyContent: 'center',
  },
  button: {
    fontSize: '2rem',
  },
  buttonWrapper: {
    margin: t.spacing(6, 0),
  },
  selector: {
    position: 'absolute',
  },
  uploadWrapper: {
    margin: t.spacing(6, 0),
    position: 'relative',
  },
}))

export default function SyncHome() {
  const classes = useStyles()

  const { urls } = NamedRoutes.use()

  const selectRef = React.useRef<HTMLElement | null>(null)
  const focusSelect = React.useCallback(() => {
    if (selectRef.current) selectRef.current.focus()
  }, [])

  return (
    <Layout noFooter>
      <M.Container maxWidth="lg" className={classes.root}>
        <Link to={urls.syncDownload()} className={classes.buttonWrapper}>
          <M.Button
            size="large"
            variant="contained"
            color="primary"
            className={classes.button}
          >
            Download
          </M.Button>
        </Link>
        <div className={classes.uploadWrapper}>
          <M.Button
            size="large"
            variant="outlined"
            color="primary"
            className={classes.button}
            onClick={focusSelect}
          >
            Upload
          </M.Button>
        </div>
        <div className={classes.selector}>
          <BucketSelect ref={selectRef} />
        </div>
      </M.Container>
    </Layout>
  )
}
