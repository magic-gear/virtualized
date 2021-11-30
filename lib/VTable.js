import React, { Component } from 'react'
import AntTableAdaptor from './AntTableAdaptor'
import { Table as AntTable, Spin } from 'antd'
import { AutoSizer, Table, CellMeasurer, CellMeasurerCache, Column } from 'react-virtualized'
import { getColumnKey } from './AntTableAdaptor/util'
import shallowEqual from 'shallowequal'
import cx from 'classnames'

class VTable extends Component {
  constructor(props) {
    super(props)
    this._table = React.createRef()
    this._keyMapper = (rowIndex, columnIndex) => {
      const { dataSource, columns } = this.props
      const col = columns[columnIndex]
      if (!col) return null
      if (dataSource[rowIndex]) {
        return props.getRowKey(dataSource[rowIndex], rowIndex) + getColumnKey(col, columnIndex)
      }
      return `${rowIndex}${columnIndex}`
    }
    this._cache = new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: props.defaultRowHeight,
      keyMapper: this._keyMapper,
    })
    this.props.getOnChange(this._recomputeTables)
  }

  componentDidUpdate(prevProps) {
    const { dataSource, columns, updateDeps, selectedKeySet } = this.props
    let shouldRecompute = false
    let shouldClearCache = false
    if (
      !shallowEqual(updateDeps, prevProps.updateDeps) ||
      selectedKeySet !== prevProps.selectedKeySet
    ) {
      // _forceUpdate has no effect use _recomputeTables instead
      shouldRecompute = true
    }
    if (dataSource !== prevProps.dataSource) {
      if (dataSource.length && !prevProps.dataSource.length) {
        this._table.current && this._table.current.scrollToPosition(0.01)
      }
      shouldRecompute = true
    }
    if (columns.length !== prevProps.columns.length) {
      shouldClearCache = true
      this._cache._columnCount = columns.length
      shouldRecompute = true
    }
    shouldClearCache && this._cache.clearAll()
    shouldRecompute && this._recomputeTables()
  }

  _headerRenderer = (arg, col, index) => {
    const key = getColumnKey(col, index)
    const { className: _className, ...rest } = col.onHeaderCell?.(col) ?? {}
    return (
      <div key={key} {...rest}>
        {arg.label}
      </div>
    )
  }
  _recomputeTables = () => {
    this._table.current && this._table.current.recomputeRowHeights()
  }
  forceUpdateGrid = () => {
    this._table.current && this._table.current.forceUpdateGrid()
  }
  _cellRenderer = (arg) => {
    const { columnIndex, cellData, rowData, parent, rowIndex } = arg
    const col = this.props.columns[columnIndex] || {}
    const rowAttrs = this.props.onRow(rowData)
    const cellClasses = cx({
      [col.className]: true,
      'virtualized-table-cell': true,
      [this.props.rowClassName(rowData)]: true,
    })
    if (!this.props.rowHeight) {
      return (
        <CellMeasurer
          cache={this._cache}
          columnIndex={columnIndex}
          key={this._keyMapper(rowIndex, columnIndex)}
          parent={parent}
          rowIndex={rowIndex}
        >
          <div className={cellClasses} {...rowAttrs}>
            {col.render ? col.render(cellData, rowData, rowIndex) : String(cellData ?? '')}
          </div>
        </CellMeasurer>
      )
    }
    return (
      <div className={cellClasses} {...rowAttrs}>
        {col.render ? col.render(cellData, rowData, rowIndex) : String(cellData ?? '')}
      </div>
    )
  }
  onResize = ({ width }) => {
    // Heights may be invalid if width has changed...
    if (width !== this._lastRenderedWidth) {
      cancelAnimationFrame(this.framer)
      this.framer = requestAnimationFrame(() => {
        this._lastRenderedWidth = width
        this._cache.clearAll()
        this._recomputeTables()
      })
    }
  }

  render() {
    const {
      loading,
      style,
      dataSource,
      columns,
      className,
      footer,
      emptyText,
      scroll,
      headerHeight,
      scrollToIndex,
      rowHeight,
      showHeader,
      size,
      onRowsRendered,
    } = this.props
    return (
      <div
        className={cx(className, 'virtualized-wrapper')}
        style={{ height: scroll?.y, ...style }}
      >
        <Spin {...loading}>
          <div style={{ flex: 1 }}>
            <AutoSizer onResize={this.onResize}>
              {({ height, width }) => {
                const colWidths = columns.map((col) => {
                  if (col.className === 'ant-table-selection-column') {
                    if (size === 'small') return Math.max(col.width, 46)
                    return col.width
                  }
                  if (/^\d+(px)?$/.test(col.width)) return parseFloat(col.width)
                  if (/^\d+(\.\d+)?%$/.test(col.width))
                    return (parseFloat(col.width.replace(/%/, '')) / 100) * width
                  return 40
                })
                return (
                  <>
                    <Table
                      onRowsRendered={onRowsRendered}
                      onScrollbarPresenceChange={() => {
                        setTimeout(() => {
                          this._table.current?.recomputeGridSize()
                        }, 0)
                      }}
                      ref={this._table}
                      scrollToIndex={scrollToIndex}
                      deferredMeasurementCache={!rowHeight ? this._cache : undefined}
                      width={width}
                      height={height}
                      overscanRowCount={2}
                      disableHeader={!showHeader}
                      rowHeight={rowHeight || this._cache.rowHeight}
                      headerHeight={headerHeight}
                      rowCount={dataSource.length}
                      rowGetter={({ index }) => dataSource[index]}
                      isScrollingOptOut
                    >
                      {columns.map((col, index) => {
                        const className = col.onHeaderCell?.(col)?.className
                        return (
                          <Column
                            key={getColumnKey(col, index)}
                            label={col.title}
                            dataKey={col.dataIndex || col.key || index}
                            width={colWidths[index]}
                            cellRenderer={this._cellRenderer}
                            flexShrink={col.className === 'ant-table-selection-column' ? 0 : 1}
                            flexGrow={col.className === 'ant-table-selection-column' ? 0 : 1}
                            headerRenderer={(arg) => this._headerRenderer(arg, col, index)}
                            headerClassName={cx(col.className, className)}
                          />
                        )
                      })}
                    </Table>
                  </>
                )
              }}
            </AutoSizer>
            {!dataSource.length && (
              <div className={'ant-table-placeholder'} style={{ paddingTop: headerHeight }}>
                {!loading.spinning && emptyText}
              </div>
            )}
          </div>
          {footer ? (
            <div className={'ant-table-footer'} style={{ flexShrink: 0 }}>
              {footer()}
            </div>
          ) : null}
        </Spin>
      </div>
    )
  }
}

VTable.Column = AntTable.Column
VTable.defaultProps = {
  defaultRowHeight: 30,
}
export default AntTableAdaptor(VTable)
