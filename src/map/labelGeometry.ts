import { getCenter } from 'ol/extent'
import type Geometry from 'ol/geom/Geometry'
import LineString from 'ol/geom/LineString'
import MultiLineString from 'ol/geom/MultiLineString'
import MultiPoint from 'ol/geom/MultiPoint'
import MultiPolygon from 'ol/geom/MultiPolygon'
import Point from 'ol/geom/Point'
import Polygon from 'ol/geom/Polygon'

function findClosestPointToExtentCenter(points: Point[], geometry: Geometry): Point | undefined {
  const [centerX, centerY] = getCenter(geometry.getExtent())

  return points.reduce<Point | undefined>((closestPoint, candidatePoint) => {
    if (!closestPoint) {
      return candidatePoint
    }

    const [closestX, closestY] = closestPoint.getCoordinates()
    const [candidateX, candidateY] = candidatePoint.getCoordinates()
    const closestDistance = (closestX - centerX) ** 2 + (closestY - centerY) ** 2
    const candidateDistance = (candidateX - centerX) ** 2 + (candidateY - centerY) ** 2
    return candidateDistance < closestDistance ? candidatePoint : closestPoint
  }, undefined)
}

function findClosestLineToExtentCenter(lines: LineString[], geometry: Geometry): LineString | undefined {
  const [centerX, centerY] = getCenter(geometry.getExtent())

  return lines.reduce<LineString | undefined>((closestLine, candidateLine) => {
    if (!closestLine) {
      return candidateLine
    }

    const [closestX, closestY] = closestLine.getCoordinateAt(0.5)
    const [candidateX, candidateY] = candidateLine.getCoordinateAt(0.5)
    const closestDistance = (closestX - centerX) ** 2 + (closestY - centerY) ** 2
    const candidateDistance = (candidateX - centerX) ** 2 + (candidateY - centerY) ** 2
    return candidateDistance < closestDistance ? candidateLine : closestLine
  }, undefined)
}

export function createRepresentativePoint(geometry: Geometry): Point {
  if (geometry instanceof Point) {
    return geometry
  }

  if (geometry instanceof Polygon) {
    return geometry.getInteriorPoint()
  }

  if (geometry instanceof MultiPolygon) {
    return (
      findClosestPointToExtentCenter(geometry.getInteriorPoints().getPoints(), geometry) ??
      new Point(getCenter(geometry.getExtent()))
    )
  }

  if (geometry instanceof LineString) {
    return new Point(geometry.getCoordinateAt(0.5))
  }

  if (geometry instanceof MultiLineString) {
    const line = findClosestLineToExtentCenter(geometry.getLineStrings(), geometry)
    return line ? new Point(line.getCoordinateAt(0.5)) : new Point(getCenter(geometry.getExtent()))
  }

  if (geometry instanceof MultiPoint) {
    return (
      findClosestPointToExtentCenter(geometry.getPoints(), geometry) ??
      new Point(getCenter(geometry.getExtent()))
    )
  }

  return new Point(getCenter(geometry.getExtent()))
}
