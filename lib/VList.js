import React, { Component } from 'react'
import { AutoSizer, List, CellMeasurerCache, CellMeasurer } from 'react-virtualized'
import { Empty, Spin } from 'antd'
import { getRecordKey } from './AntTableAdaptor/util'
import shallowEqual from 'shallowequal'
import cx from 'classnames'

class VList extends Component {
  constructor(props) {
    super(props)
    this.getRecordKey = getRecordKey.bind(this)
    this._keyMapper = (rowIndex) => {
      const data = this.props.dataSource
      return data[rowIndex] ? this.getRecordKey(data[rowIndex], rowIndex) : rowIndex
    }
    this._cache = new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: props.rowHeight || 38,
      keyMapper: this._keyMapper,
    })
    this._list = React.createRef()
    this.state = {}
  }

  componentDidUpdate(prevProps) {
    const { resetDeps, updateDeps, dataSource, loading } = this.props
    let shouldRecompute = false
    let shouldClearCache = false
    if (!shallowEqual(prevProps.resetDeps, resetDeps)) {
      shouldClearCache = true
      shouldRecompute = true
    }
    if (dataSource !== prevProps.dataSource || !shallowEqual(loading, prevProps.loading)) {
      shouldRecompute = true
    }
    shouldClearCache && this._cache.clearAll()
    shouldRecompute && this._recomputeTables()
    if (!shallowEqual(prevProps.updateDeps, updateDeps)) {
      this._forceUpdate()
    }
  }

  _recomputeTables = () => {
    this._list.current && this._list.current.recomputeGridSize()
  }
  _forceUpdate = () => {
    this._list.current && this._list.current.forceUpdateGrid()
  }

  _rowRenderer = ({ index, style, parent }) => {
    const { renderItem, rowHeight, dataSource } = this.props
    if (!rowHeight) {
      return (
        <CellMeasurer
          cache={this._cache}
          columnIndex={0}
          rowIndex={index}
          key={this._keyMapper(index)}
          parent={parent}
        >
          <div role={'row'} style={style}>
            {renderItem(dataSource[index], index, style)}
          </div>
        </CellMeasurer>
      )
    }
    return (
      <div role={'row'} key={this._keyMapper(index)} style={style}>
        {renderItem(dataSource[index], index)}
      </div>
    )
  }
  _noRowsRenderer = () => {
    const { dataSource } = this.props
    let loading = this.props.loading
    if (typeof loading === 'boolean') {
      loading = {
        spinning: loading,
      }
    }
    const emptyText = this.props.locale.emptyText || (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className={'ant-empty-normal'} />
    )
    if (dataSource.length) return
    return <div className={'ant-list-empty-text'}>{!loading?.spinning && emptyText}</div>
  }

  render() {
    const {
      height,
      rowHeight,
      overscanRowCount,
      dataSource,
      className,
      style,
      scrollToIndex,
      onRowsRendered,
      onScrollbarPresenceChange,
    } = this.props
    let loading = this.props.loading
    if (typeof loading === 'boolean') {
      loading = {
        spinning: loading,
      }
    }
    return (
      <div className={cx(className, 'virtualized-wrapper')} style={{ height, ...style }}>
        <Spin {...loading}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={this._list}
                deferredMeasurementCache={rowHeight ? undefined : this._cache}
                height={height}
                overscanRowCount={overscanRowCount}
                noRowsRenderer={this._noRowsRenderer}
                rowCount={dataSource.length}
                scrollToIndex={scrollToIndex}
                rowHeight={rowHeight ? rowHeight : this._cache.rowHeight}
                onScrollbarPresenceChange={onScrollbarPresenceChange}
                rowRenderer={this._rowRenderer}
                onRowsRendered={onRowsRendered}
                width={width}
              />
            )}
          </AutoSizer>
        </Spin>
      </div>
    )
  }
}

VList.defaultProps = {
  dataSource: [],
  className: '',
  size: 'default',
  loading: false,
  locale: {},
  rowKey: 'key',
  renderItem: () => null,
}
export default VList
