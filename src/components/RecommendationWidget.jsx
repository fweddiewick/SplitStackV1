import React from 'react';
import { RecommendationWidget as WidgetComponent } from './RecommendationWidget.tsx';

/**
 * RecommendationWidget.jsx
 * Wrapper component exporting RecommendationWidget safely for JSX and TSX consumers
 */
export function RecommendationWidget(props) {
  return React.createElement(WidgetComponent, props);
}

export default RecommendationWidget;
