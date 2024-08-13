import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    formatDate,
    getDayOfWeek,
    getFirstDayOfWeek,
    getDayOfWeekName,
    getWeekNumber
} from "eez-studio-shared/util";

import type { History } from "instrument/window/history/history";

export const Day = observer(
    class Day extends React.Component<{ history: History; day: Date }> {
        render() {
            const day = this.props.day;

            const activityCount =
                this.props.history.calendar.getActivityCount(day);

            let activityLevel;

            let activityInfo;
            if (activityCount > 0) {
                activityInfo = `${activityCount} log items`;
                if (activityCount < 25) {
                    activityLevel = 1;
                } else if (activityCount < 75) {
                    activityLevel = 2;
                } else if (activityCount < 200) {
                    activityLevel = 3;
                } else {
                    activityLevel = 4;
                }
            } else {
                activityInfo = "No activity";
                activityLevel = 0;
            }

            let className = classNames(`activity-level-${activityLevel}`, {
                selected: this.props.history.calendar.isSelectedDay(day)
            });

            const tooltip = `${activityInfo} on ${formatDate(day)}`;

            return (
                <div
                    className={className}
                    title={tooltip}
                    onClick={action(() => {
                        if (
                            this.props.history.calendar.getActivityCount(day) >
                            0
                        ) {
                            this.props.history.calendar.selectDay(day);
                        }
                    })}
                >
                    <div>{day.getDate().toString()}</div>
                </div>
            );
        }
    }
);

export class DayOfWeek extends React.Component<{ dayOfWeek: number }> {
    render() {
        return <div>{getDayOfWeekName(this.props.dayOfWeek).slice(0, 2)}</div>;
    }
}

export const Month = observer(
    class Month extends React.Component<{ history: History; month: Date }> {
        element: HTMLElement | null;

        componentDidMount() {
            if (
                this.element &&
                this.props.history.calendar.isSelectedMonth(this.props.month)
            ) {
                this.element.scrollIntoView({ block: "end" });
            }
        }

        componentDidUpdate() {
            if (
                this.element &&
                this.props.history.calendar.isSelectedMonth(this.props.month)
            ) {
                this.element.scrollIntoView({
                    block: "nearest",
                    behavior: "auto"
                });
            }
        }

        renderDays() {
            const days = [];

            const month = this.props.month;

            // 1st row contains day of week names
            for (let i = 0; i < 7; i++) {
                days.push(
                    <DayOfWeek
                        key={"dow" + i}
                        dayOfWeek={(getFirstDayOfWeek() + i) % 7}
                    />
                );
            }

            // 8th column of the 1st row is empty (8th column contains week number)
            days.push(<div key={"dow7"} />);

            let start = -getDayOfWeek(month);

            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 7; col++) {
                    const i = start + row * 7 + col;
                    const day = new Date(month);
                    day.setDate(day.getDate() + i);

                    if (day.getMonth() === month.getMonth()) {
                        days.push(
                            <Day
                                key={i}
                                history={this.props.history}
                                day={day}
                            />
                        );
                    } else {
                        if (
                            day.getMonth() != month.getMonth() &&
                            day > month &&
                            col === 0
                        ) {
                            return days;
                        }
                        // empty cell
                        days.push(<div key={i} />);
                    }
                }

                // week number
                const i = start + row * 7;
                const day = new Date(month);
                day.setDate(day.getDate() + i);
                days.push(
                    <div key={"w" + row} className="WeekNumber">
                        {getWeekNumber(day)}.
                    </div>
                );
            }

            return days;
        }

        render() {
            const month = this.props.month;

            let className = classNames({
                selected: this.props.history.calendar.isSelectedMonth(month)
            });

            return (
                <div className={className} ref={ref => (this.element = ref)}>
                    <div>{formatDate(month, "YYYY MMMM")}</div>
                    <div>{this.renderDays()}</div>
                </div>
            );
        }
    }
);

export const Calendar = observer(
    class Calendar extends React.Component<{ history: History }> {
        monthHasActivity(month: Date) {
            let start = -getDayOfWeek(month);

            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 7; col++) {
                    const i = start + row * 7 + col;
                    const day = new Date(month);
                    day.setDate(day.getDate() + i);

                    if (day.getMonth() === month.getMonth()) {
                        if (this.props.history.calendar.getActivityCount(day)) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        render() {
            var months = [];

            var startMonth = new Date(this.props.history.calendar.minDate);
            startMonth.setDate(1);
            startMonth.setHours(0, 0, 0, 0);

            var endMonth = new Date(this.props.history.calendar.maxDate);
            endMonth.setDate(1);
            endMonth.setHours(0, 0, 0, 0);

            var month = new Date(startMonth);
            while (month <= endMonth) {
                if (!(month < endMonth) || this.monthHasActivity(month)) {
                    months.push(
                        <Month
                            key={month.toString()}
                            history={this.props.history}
                            month={new Date(month)}
                        />
                    );
                }

                month.setMonth(month.getMonth() + 1);
            }

            return <div className="EezStudio_HistoryCalendar">{months}</div>;
        }
    }
);
