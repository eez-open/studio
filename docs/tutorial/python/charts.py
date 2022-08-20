import sys
import io
import base64
import time

def send_message(message):
    print(message)
    sys.stdout.flush()

send_message("Script started")

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import matplotlib.cbook as cbook

# Fixing random state for reproducibility
np.random.seed(19680801)

send_message("Matplotlib loaded")
time.sleep(1)

DPI = 100
WIDTH = 620
HEIGHT = 430

def px_to_inch(px):
    return px / DPI

def make_chart(chart_type):
    if chart_type == "Bar Label Demo":
        N = 5
        menMeans = (20, 35, 30, 35, -27)
        womenMeans = (25, 32, 34, 20, -25)
        menStd = (2, 3, 4, 1, 2)
        womenStd = (3, 5, 2, 3, 3)
        ind = np.arange(N)    # the x locations for the groups
        width = 0.35       # the width of the bars: can also be len(x) sequence

        fig, ax = plt.subplots()

        p1 = ax.bar(ind, menMeans, width, yerr=menStd, label='Men')
        p2 = ax.bar(ind, womenMeans, width,
                    bottom=menMeans, yerr=womenStd, label='Women')

        ax.axhline(0, color='grey', linewidth=0.8)
        ax.set_ylabel('Scores')
        ax.set_title('Scores by group and gender')
        ax.set_xticks(ind, labels=['G1', 'G2', 'G3', 'G4', 'G5'])
        ax.legend()

        # Label with label_type 'center' instead of the default 'edge'
        ax.bar_label(p1, label_type='center')
        ax.bar_label(p2, label_type='center')
        ax.bar_label(p2)

        fig.set_size_inches(px_to_inch(WIDTH), px_to_inch(HEIGHT))
        return fig

    if chart_type == "Coherence of two signals":
        dt = 0.01
        t = np.arange(0, 30, dt)
        nse1 = np.random.randn(len(t))                 # white noise 1
        nse2 = np.random.randn(len(t))                 # white noise 2

        # Two signals with a coherent part at 10Hz and a random part
        s1 = np.sin(2 * np.pi * 10 * t) + nse1
        s2 = np.sin(2 * np.pi * 10 * t) + nse2

        fig, axs = plt.subplots(2, 1)
        axs[0].plot(t, s1, t, s2)
        axs[0].set_xlim(0, 2)
        axs[0].set_xlabel('time')
        axs[0].set_ylabel('s1 and s2')
        axs[0].grid(True)

        cxy, f = axs[1].cohere(s1, s2, 256, 1. / dt)
        axs[1].set_ylabel('coherence')

        fig.tight_layout()

        fig.set_size_inches(px_to_inch(WIDTH), px_to_inch(HEIGHT))
        return fig

    if chart_type == "Scatter Demo2":
        # Load a numpy record array from yahoo csv data with fields date, open, close,
        # volume, adj_close from the mpl-data/example directory. The record array
        # stores the date as an np.datetime64 with a day unit ('D') in the date column.
        price_data = (cbook.get_sample_data('goog.npz', np_load=True)['price_data']
                    .view(np.recarray))
        price_data = price_data[-250:]  # get the most recent 250 trading days

        delta1 = np.diff(price_data.adj_close) / price_data.adj_close[:-1]

        # Marker size in units of points^2
        volume = (15 * price_data.volume[:-2] / price_data.volume[0])**2
        close = 0.003 * price_data.close[:-2] / 0.003 * price_data.open[:-2]

        fig, ax = plt.subplots()
        ax.scatter(delta1[:-1], delta1[1:], c=close, s=volume, alpha=0.5)

        ax.set_xlabel(r'$\Delta_i$', fontsize=15)
        ax.set_ylabel(r'$\Delta_{i+1}$', fontsize=15)
        ax.set_title('Volume and percent change')

        ax.grid(True)
        fig.tight_layout()

        fig.set_size_inches(px_to_inch(WIDTH), px_to_inch(HEIGHT))
        return fig

    return None

def get_image_data(fig):
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=DPI)
    return "data:image/png;base64," + base64.b64encode(buf.getbuffer()).decode('ascii')

for chart_type in sys.stdin:
    if chart_type[-1] == "\n":
        chart_type = chart_type[0:-1]

    send_message("Drawing " + chart_type)

    fig = make_chart(chart_type)
    if fig:
        image_data = get_image_data(fig)
        plt.close(fig)
        send_message(image_data)
    else:
        send_message("Unknown chart")

send_message("Script ended")
