import React from 'react'

export function normalizeColumns(elements) {
  const columns = []
  React.Children.forEach(elements, (element) => {
    if (!React.isValidElement(element)) {
      return
    }
    const column = Object.assign({}, element.props)
    if (element.key) {
      column.key = element.key
    }
    if (element.type && element.type.__ANT_TABLE_COLUMN_GROUP) {
      column.children = normalizeColumns(column.children)
    }
    columns.push(column)
  })
  return columns
}

export function getRecordKey(record, index) {
  const { rowKey } = this.props
  const recordKey = typeof rowKey === 'function' ? rowKey(record, index) : record[rowKey]
  return recordKey === undefined ? index : recordKey
}

export function getColumnKey(column, defaultKey) {
  if ('key' in column && column.key !== undefined) {
    return column.key
  }
  if (column.dataIndex) {
    return Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex
  }

  return defaultKey
}
