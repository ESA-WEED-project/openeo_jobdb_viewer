import { getCenter } from 'ol/extent'
import type Geometry from 'ol/geom/Geometry'
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

  if (geometry.getType() === 'LineString' || geometry.getType() === 'MultiLineString') {
    return new Point(geometry.getClosestPoint(getCenter(geometry.getExtent())))
  }

  if (geometry instanceof MultiPoint) {
    return (
      findClosestPointToExtentCenter(geometry.getPoints(), geometry) ??
      new Point(getCenter(geometry.getExtent()))
    )
  }

  return new Point(getCenter(geometry.getExtent()))
}
